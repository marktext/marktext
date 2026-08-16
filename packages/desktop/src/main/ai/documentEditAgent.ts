import type {
  AiImageAttachment,
  AiEditOperationSummary,
  AiEditSummary,
  AiRecoveryInfo
} from '@shared/types/ai'
import type { AiOutputFailureCode } from './outputRepair'
import type { ProviderToolCall } from './providerMessages'
import {
  buildDocumentPrompt,
  buildPreciseEditRepairPrompt,
  buildPreciseEditSystemPrompt,
  buildPreciseEditWholeFallbackPrompt,
  makePreciseEditMarkers,
  makePromptToken
} from './prompts'
import { assertMarkdownCompatibility, normalizeGeneratedMarkdown } from './outputRepair'

export interface DocumentEditMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: AiImageAttachment[]
}

export interface GeneratedEditResponse {
  content: string
  truncated?: boolean
  toolCalls?: ProviderToolCall[]
  toolUnsupported?: boolean
}

export interface DocumentEditValidationDiagnostic {
  attempt: number
  code?: AiOutputFailureCode
  error: string
  responseChars: number
  responseLines: number
  summaryMarkers: number
  searchMarkers: number
  dividerMarkers: number
  replaceMarkers: number
}

export interface DocumentEditGenerateRequest {
  system: string
  messages: DocumentEditMessage[]
  requestId: string
  signal: AbortSignal
  format?: 'tool' | 'protocol' | 'whole'
}

export interface DocumentEditAgentRequest {
  markdown: string
  instruction: string
  contextMessages: DocumentEditMessage[]
  attachments?: AiImageAttachment[]
  requestId: string
  signal: AbortSignal
  generate: (request: DocumentEditGenerateRequest) => Promise<GeneratedEditResponse>
  generateTool?: (request: DocumentEditGenerateRequest) => Promise<GeneratedEditResponse>
  generateWhole?: (request: DocumentEditGenerateRequest) => Promise<GeneratedEditResponse>
  onValidationFailure?: (diagnostic: DocumentEditValidationDiagnostic) => void
}

export interface DocumentEditAgentResult {
  markdown: string
  summary: AiEditSummary
  message?: string
  attempts: number
  recovery?: AiRecoveryInfo
  requiresConfirmation?: boolean
}

interface ParsedEdit {
  search: string
  replace: string
}

interface ParsedEditResponse {
  message?: string
  edits: ParsedEdit[]
}

interface LocatedEdit extends ParsedEdit {
  start: number
  end: number
  summary: AiEditOperationSummary
}

const MAX_ATTEMPTS = 2
const MAX_OPERATIONS = 32
const MAX_MESSAGE_LENGTH = 240

const makeDelimiter = (): string => makePromptToken('MT_EDIT')

const classifyEditFailure = (failure: string): AiOutputFailureCode => {
  if (/SEARCH block|overlap|empty SEARCH|multiple locations|match the document/i.test(failure)) return 'exact-match'
  if (/truncated/i.test(failure)) return 'truncated'
  return 'contract'
}

const stripOuterProtocolFence = (response: string, delimiter: string): string => {
  const normalized = response.replaceAll('\r\n', '\n').trim()
  const lines = normalized.split('\n')
  const markers = makePreciseEditMarkers(delimiter)
  if (lines.length < 3 || !/^\s*(`{3,}|~{3,})[^`~]*\s*$/.test(lines[0])) return normalized
  if (!lines.some(line => isMarkerLine(line, markers.search))) return normalized
  const opening = lines[0].trim()[0]
  const closing = lines[lines.length - 1].trim()
  if (closing[0] !== opening || !new RegExp(`^${opening}{3,}$`).test(closing)) return normalized
  return lines.slice(1, -1).join('\n').trim()
}

interface ParsedToolEditResponse {
  message?: string
  edits: ParsedEdit[]
}

const repairBareDividers = (response: string, markdown: string, delimiter: string): string => {
  const normalized = stripOuterProtocolFence(response, delimiter)
  const markers = makePreciseEditMarkers(delimiter)
  const lines = normalized.split('\n')
  let index = 0
  let changed = false
  while (index < lines.length) {
    if (!isMarkerLine(lines[index], markers.search)) {
      index += 1
      continue
    }
    const searchStart = index + 1
    let replaceIndex = searchStart
    while (replaceIndex < lines.length && !isMarkerLine(lines[replaceIndex], markers.replace)) replaceIndex += 1
    if (replaceIndex >= lines.length) break
    const candidates: number[] = []
    for (let candidate = searchStart; candidate < replaceIndex; candidate += 1) {
      if (!/^\s*={7}\s*$/.test(lines[candidate])) continue
      const search = lines.slice(searchStart, candidate).join('\n')
      const matches = search ? countOccurrences(markdown, search) : markdown ? [] : [0]
      if (matches.length === 1) candidates.push(candidate)
    }
    if (candidates.length === 1 && lines[candidates[0]].trim() !== markers.divider) {
      lines[candidates[0]] = markers.divider
      changed = true
    }
    index = replaceIndex + 1
  }
  return changed ? lines.join('\n') : normalized
}

const parseToolEditResponse = (input: unknown): ParsedToolEditResponse => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The structured edit response was not an object.')
  const value = input as Record<string, unknown>
  if (value.status !== 'changed' && value.status !== 'no_changes') throw new Error('The structured edit response has an invalid status.')
  if (typeof value.summary !== 'string') throw new Error('The structured edit response is missing its summary.')
  if (!Array.isArray(value.edits)) throw new Error('The structured edit response is missing its edit list.')
  const edits = value.edits.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('A structured edit is not an object.')
    const edit = item as Record<string, unknown>
    if (typeof edit.search !== 'string' || typeof edit.replace !== 'string') throw new Error('A structured edit is missing SEARCH or REPLACE text.')
    return { search: edit.search, replace: edit.replace }
  })
  if (value.status === 'no_changes' && edits.length) throw new Error('NO_CHANGES cannot include edit blocks.')
  if (value.status === 'changed' && !edits.length) throw new Error('A changed structured response must include an edit block.')
  return { message: cleanMessage(value.summary), edits }
}

const lineNumberAt = (value: string, offset: number): number =>
  value.slice(0, offset).split('\n').length

const changedSpan = (before: string, after: string): { beforeStart: number; beforeEnd: number; afterStart: number; afterEnd: number } => {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  ) suffix += 1
  return {
    beforeStart: prefix,
    beforeEnd: before.length - suffix,
    afterStart: prefix,
    afterEnd: after.length - suffix
  }
}

const lineRangeAt = (value: string, start: number, end: number): { startLine: number; endLine: number } => ({
  startLine: lineNumberAt(value, start),
  endLine: lineNumberAt(value, end > start ? end - 1 : start)
})

const splitLines = (value: string): string[] => value.split('\n')

const lineChangeCounts = (search: string, replace: string): { addedLines: number; removedLines: number } => {
  const searchLines = splitLines(search)
  const replaceLines = splitLines(replace)
  let prefix = 0
  while (prefix < searchLines.length && prefix < replaceLines.length && searchLines[prefix] === replaceLines[prefix]) {
    prefix += 1
  }
  let suffix = 0
  while (
    suffix < searchLines.length - prefix &&
    suffix < replaceLines.length - prefix &&
    searchLines[searchLines.length - suffix - 1] === replaceLines[replaceLines.length - suffix - 1]
  ) {
    suffix += 1
  }
  return {
    addedLines: Math.max(0, replaceLines.length - prefix - suffix),
    removedLines: Math.max(0, searchLines.length - prefix - suffix)
  }
}

const countOccurrences = (value: string, search: string): number[] => {
  if (!search) return [0]
  const locations: number[] = []
  let offset = 0
  while (offset <= value.length - search.length) {
    const found = value.indexOf(search, offset)
    if (found < 0) break
    locations.push(found)
    offset = found + 1
  }
  return locations
}

const isMarkerLine = (line: string, marker: string): boolean => line.trim() === marker

const countMarkerLines = (lines: string[], marker: string): number =>
  lines.filter(line => line.trim() === marker).length

const cleanMessage = (value: string): string | undefined => {
  const message = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!message || message.length > MAX_MESSAGE_LENGTH) return undefined
  return message
}

const parseEditResponse = (response: string, markdown: string, delimiter: string): ParsedEditResponse => {
  const normalized = repairBareDividers(response, markdown, delimiter)
  const markers = makePreciseEditMarkers(delimiter)
  const lines = normalized.split('\n')
  let first = 0
  while (first < lines.length && !lines[first].trim()) first += 1
  let last = lines.length - 1
  while (last >= first && !lines[last].trim()) last -= 1

  let message: string | undefined
  if (first <= last && isMarkerLine(lines[first], markers.summaryStart)) {
    const summaryStart = first + 1
    let summaryEnd = summaryStart
    while (summaryEnd <= last && !isMarkerLine(lines[summaryEnd], markers.summaryEnd)) summaryEnd += 1
    if (summaryEnd <= last) {
      message = cleanMessage(lines.slice(summaryStart, summaryEnd).join('\n'))
      first = summaryEnd + 1
      while (first <= last && !lines[first].trim()) first += 1
    } else {
      const searchStart = lines.findIndex((line, index) => index >= summaryStart && isMarkerLine(line, markers.search))
      if (searchStart >= 0) first = searchStart
      else throw new Error('The summary block is incomplete.')
    }
  }

  if (first > last) throw new Error('The response did not contain an edit instruction.')
  if (isMarkerLine(lines[first], markers.noChanges)) {
    if (lines.slice(first + 1, last + 1).some(line => line.trim())) {
      throw new Error('Unexpected text after NO_CHANGES.')
    }
    return { message, edits: [] }
  }
  if (!isMarkerLine(lines[first], markers.search)) {
    throw new Error('The response must contain only precise SEARCH/REPLACE edit blocks.')
  }

  const edits: ParsedEdit[] = []
  let index = first
  while (index <= last) {
    if (!lines[index].trim()) {
      index += 1
      continue
    }
    if (!isMarkerLine(lines[index], markers.search)) {
      throw new Error('Unexpected text outside a SEARCH/REPLACE edit block.')
    }
    index += 1
    const searchStart = index
    while (index <= last && !isMarkerLine(lines[index], markers.divider)) index += 1
    if (index > last) throw new Error('An edit block is missing its divider.')
    const search = lines.slice(searchStart, index).join('\n')
    index += 1
    const replaceStart = index
    while (index <= last && !isMarkerLine(lines[index], markers.replace)) index += 1
    if (index > last) throw new Error('An edit block is missing its closing marker.')
    const replace = lines.slice(replaceStart, index).join('\n')
    if (search === replace) throw new Error('An edit block does not change any text.')
    if (!search && markdown) throw new Error('SEARCH cannot be empty for a non-empty document.')
    edits.push({ search, replace })
    index += 1
  }

  if (edits.length > MAX_OPERATIONS) {
    throw new Error(`The response contains more than ${MAX_OPERATIONS} edit blocks.`)
  }
  if (!edits.length) {
    throw new Error('The response did not contain an edit block.')
  }
  return { message, edits }
}

const lineEndingVariants = (value: string, markdown: string): string[] => {
  const normalized = value.replaceAll('\r\n', '\n')
  if (!markdown.includes('\r\n') || !normalized.includes('\n')) return [normalized]
  return [normalized, normalized.replaceAll('\n', '\r\n')]
}

const locateEdits = (edits: ParsedEdit[], markdown: string): LocatedEdit[] => {
  if (!markdown && edits.filter(edit => !edit.search).length > 1) {
    throw new Error('An empty document can contain only one empty SEARCH block.')
  }
  const located = edits.map((edit) => {
    const candidates = lineEndingVariants(edit.search, markdown)
    const replacementCandidates = lineEndingVariants(edit.replace, markdown)
    const matchesByCandidate = candidates.map(search => ({
      search,
      matches: countOccurrences(markdown, search)
    }))
    const matched = matchesByCandidate.find(candidate => candidate.matches.length > 0)
    const search = matched?.search ?? edit.search
    const matches = matched?.matches ?? []
    if (!edit.search && markdown) {
      throw new Error('An empty SEARCH block can only target an empty document.')
    }
    if (matches.length === 0) {
      throw new Error('A SEARCH block did not exactly match the document.')
    }
    if (matches.length > 1) {
      throw new Error('A SEARCH block matched multiple locations; include more surrounding context.')
    }
    const start = matches[0]
    const end = start + search.length
    const replacement = replacementCandidates[candidates.indexOf(search)] ?? edit.replace
    const counts = lineChangeCounts(search, replacement)
    return {
      search,
      replace: replacement,
      start,
      end,
      summary: {
        startLine: lineNumberAt(markdown, start),
        endLine: lineNumberAt(markdown, end),
        ...counts
      }
    }
  })

  const sorted = [...located].sort((left, right) => left.start - right.start)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) {
      throw new Error('Edit blocks overlap; combine overlapping changes into one block.')
    }
  }
  return located
}

const applyEdits = (markdown: string, edits: LocatedEdit[]): string => {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (value, edit) => `${value.slice(0, edit.start)}${edit.replace}${value.slice(edit.end)}`,
      markdown
    )
}

const normalizeLocatedEdits = (edits: LocatedEdit[]): { edits: LocatedEdit[]; changes: string[] } => {
  const changes = new Set<string>()
  const normalized = edits.map((edit) => {
    const result = normalizeGeneratedMarkdown(edit.replace, { preserveWhitespace: true })
    for (const change of result.changes) changes.add(change)
    const replace = edit.replace.includes('\r\n') ? result.content.replaceAll('\n', '\r\n') : result.content
    return { ...edit, replace }
  })
  return { edits: normalized, changes: [...changes] }
}

const summarize = (markdown: string, edits: LocatedEdit[]): AiEditSummary => ({
  operationCount: edits.length,
  addedLines: edits.reduce((total, edit) => total + edit.summary.addedLines, 0),
  removedLines: edits.reduce((total, edit) => total + edit.summary.removedLines, 0),
  operations: (() => {
    const afterMarkdown = applyEdits(markdown, edits)
    let delta = 0
    return [...edits].sort((left, right) => left.start - right.start).map((edit) => {
      const span = changedSpan(edit.search, edit.replace)
      const beforeRange = lineRangeAt(markdown, edit.start + span.beforeStart, edit.start + span.beforeEnd)
      const afterStartOffset = edit.start + delta + span.afterStart
      const afterEndOffset = edit.start + delta + span.afterEnd
      const afterRange = lineRangeAt(afterMarkdown, afterStartOffset, afterEndOffset)
      delta += edit.replace.length - edit.search.length
      return {
        ...edit.summary,
        startLine: beforeRange.startLine,
        endLine: beforeRange.endLine,
        afterStartLine: afterRange.startLine,
        afterEndLine: afterRange.endLine,
        afterStartOffset,
        afterEndOffset
      }
    })
  })()
})

export const runDocumentEditAgent = async(request: DocumentEditAgentRequest): Promise<DocumentEditAgentResult> => {
  const delimiter = makeDelimiter()
  const system = buildPreciseEditSystemPrompt(delimiter)
  const documentPrompt = buildDocumentPrompt(request.instruction, request.markdown, delimiter)
  let previousResponse = ''
  let failure = ''
  let toolAttempted = false

  if (request.generateTool) {
    const generated = await request.generateTool({
      system,
      messages: [
        ...request.contextMessages,
        { role: 'user', content: documentPrompt, attachments: request.attachments }
      ],
      requestId: request.requestId,
      signal: request.signal,
      format: 'tool'
    })
    if (!generated.toolUnsupported) {
      toolAttempted = true
      try {
        if (generated.truncated) throw new Error('The structured edit response was truncated.')
        const toolCall = generated.toolCalls?.find(call => call.name === 'submit_markdown_edits')
        if (!toolCall) throw new Error('The provider returned no structured edit tool call.')
        const parsed = parseToolEditResponse(toolCall.input)
        const locatedResult = normalizeLocatedEdits(locateEdits(parsed.edits, request.markdown))
        const located = locatedResult.edits
        return {
          markdown: applyEdits(request.markdown, located),
          summary: summarize(request.markdown, located),
          message: parsed.message,
          attempts: 1,
          recovery: {
            strategy: locatedResult.changes.length ? 'local-normalization' : 'direct',
            attempts: 1,
            changes: locatedResult.changes.length ? locatedResult.changes : undefined
          }
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error)
        const response = generated.content || JSON.stringify(generated.toolCalls?.[0]?.input ?? '')
        previousResponse = response
        request.onValidationFailure?.({
          attempt: 1,
          code: classifyEditFailure(failure),
          error: failure,
          responseChars: response.length,
          responseLines: response.replaceAll('\r\n', '\n').split('\n').length,
          summaryMarkers: 0,
          searchMarkers: 0,
          dividerMarkers: 0,
          replaceMarkers: 0
        })
      }
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const messages: DocumentEditMessage[] = [
      ...request.contextMessages,
      { role: 'user', content: documentPrompt, attachments: request.attachments }
    ]
    if (previousResponse) {
      messages.push(
        { role: 'assistant', content: previousResponse },
        { role: 'user', content: buildPreciseEditRepairPrompt(failure, delimiter) }
      )
    }
    const wasRepair = !!previousResponse
    const generated = await request.generate({
      system,
      messages,
      requestId: request.requestId,
      signal: request.signal,
      format: 'protocol'
    })
    previousResponse = generated.content
    try {
      const parsed = generated.truncated
        ? (() => { throw new Error('The model response was truncated before a complete edit was returned.') })()
        : parseEditResponse(generated.content, request.markdown, delimiter)
      const locatedResult = normalizeLocatedEdits(locateEdits(parsed.edits, request.markdown))
      const located = locatedResult.edits
      return {
        markdown: applyEdits(request.markdown, located),
        summary: summarize(request.markdown, located),
        message: parsed.message,
        attempts: attempt + (toolAttempted ? 1 : 0),
        recovery: {
          strategy: locatedResult.changes.length
            ? 'local-normalization'
            : wasRepair
              ? 'model-repair'
              : 'direct',
          attempts: attempt + (toolAttempted ? 1 : 0),
          changes: locatedResult.changes.length ? locatedResult.changes : undefined
        }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
      const responseLines = generated.content.replaceAll('\r\n', '\n').split('\n')
      const markers = makePreciseEditMarkers(delimiter)
      const search = countMarkerLines(responseLines, markers.search)
      const divider = countMarkerLines(responseLines, markers.divider)
      const replace = countMarkerLines(responseLines, markers.replace)
      request.onValidationFailure?.({
        attempt,
        code: classifyEditFailure(failure),
        error: failure,
        responseChars: generated.content.length,
        responseLines: responseLines.length,
        summaryMarkers: countMarkerLines(responseLines, markers.summaryStart) + countMarkerLines(responseLines, markers.summaryEnd),
        searchMarkers: search,
        dividerMarkers: divider,
        replaceMarkers: replace
      })
      if (attempt === MAX_ATTEMPTS) {
        if (request.generateWhole) {
          const fallbackAttempt = MAX_ATTEMPTS + 1
          const fallback = await request.generateWhole({
            system: buildPreciseEditWholeFallbackPrompt(delimiter),
            messages: [
              ...request.contextMessages,
              { role: 'user', content: documentPrompt, attachments: request.attachments }
            ],
            requestId: request.requestId,
            signal: request.signal,
            format: 'whole'
          })
          try {
            if (fallback.truncated) throw new Error('The model response was truncated before a complete document was returned.')
            const normalized = normalizeGeneratedMarkdown(fallback.content, { stripOuterFence: true })
            assertMarkdownCompatibility(normalized.content)
            const located = locateEdits([{ search: request.markdown, replace: normalized.content }], request.markdown)
            return {
              markdown: applyEdits(request.markdown, located),
              summary: summarize(request.markdown, located),
              attempts: fallbackAttempt,
              recovery: {
                strategy: 'whole-document-fallback',
                attempts: fallbackAttempt,
                changes: normalized.changes,
                requiresConfirmation: true,
                warning: 'The model could not produce a precise edit block. Review the complete-document fallback before applying it.'
              },
              requiresConfirmation: true
            }
          } catch (fallbackError) {
            const fallbackFailure = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            const responseLines = fallback.content.replaceAll('\r\n', '\n').split('\n')
            request.onValidationFailure?.({
              attempt: fallbackAttempt,
              code: classifyEditFailure(fallbackFailure),
              error: fallbackFailure,
              responseChars: fallback.content.length,
              responseLines: responseLines.length,
              summaryMarkers: 0,
              searchMarkers: 0,
              dividerMarkers: 0,
              replaceMarkers: 0
            })
            throw new Error(`The AI edit could not be validated after ${fallbackAttempt} attempts. ${fallbackFailure}`)
          }
        }
        throw new Error(`The AI edit could not be validated after ${MAX_ATTEMPTS} attempts. ${failure}`)
      }
    }
  }

  throw new Error('The AI edit agent stopped unexpectedly.')
}

export const documentEditAgentLimits = {
  maxAttempts: MAX_ATTEMPTS,
  maxOperations: MAX_OPERATIONS
}
