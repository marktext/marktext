import type { AiEditSummary } from '@shared/types/ai'

export type AiChangeStatus = 'unsaved' | 'saved'

export interface AiChangeRange {
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
}
export interface AiChangeMarker {
  revisionId: string
  status: AiChangeStatus
  beforeMarkdown: string
  afterMarkdown: string
  currentMarkdown: string
  visible: boolean
  ranges: AiChangeRange[]
}

const lineNumberAt = (value: string, offset: number): number =>
  value.slice(0, Math.max(0, Math.min(offset, value.length))).split('\n').length

const lineStartOffset = (value: string, line: number): number => {
  if (line <= 1) return 0
  let offset = 0
  for (let index = 1; index < line; index += 1) {
    const newline = value.indexOf('\n', offset)
    if (newline < 0) return value.length
    offset = newline + 1
  }
  return offset
}

const lineEndOffset = (value: string, line: number): number => {
  const start = lineStartOffset(value, line)
  const newline = value.indexOf('\n', start)
  return newline < 0 ? value.length : newline
}

const lineRange = (value: string, startOffset: number, endOffset: number): Pick<AiChangeRange, 'startLine' | 'endLine'> => ({
  startLine: lineNumberAt(value, startOffset),
  endLine: lineNumberAt(value, endOffset > startOffset ? endOffset - 1 : startOffset)
})

const normalizeRange = (
  value: string,
  startOffset: number,
  endOffset: number,
  startLine?: number,
  endLine?: number
): AiChangeRange => {
  const start = Math.max(0, Math.min(startOffset, value.length))
  const end = Math.max(start, Math.min(endOffset, value.length))
  const lines = lineRange(value, start, end)
  return {
    startOffset: start,
    endOffset: end,
    startLine: startLine ?? lines.startLine,
    endLine: endLine ?? lines.endLine
  }
}

export const rangesFromSummary = (afterMarkdown: string, summary?: AiEditSummary): AiChangeRange[] => {
  if (!summary?.operations.length) return []
  return summary.operations.map((operation) => {
    const startOffset = operation.afterStartOffset ?? lineStartOffset(afterMarkdown, operation.afterStartLine ?? operation.startLine)
    const endOffset = operation.afterEndOffset ?? lineEndOffset(afterMarkdown, operation.afterEndLine ?? operation.endLine)
    return normalizeRange(
      afterMarkdown,
      startOffset,
      endOffset,
      operation.afterStartLine ?? operation.startLine,
      operation.afterEndLine ?? operation.endLine
    )
  })
}

export const fullDocumentRange = (markdown: string): AiChangeRange[] => [
  normalizeRange(markdown, 0, markdown.length, 1, Math.max(1, markdown.split('\n').length))
]

interface TextChange {
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
}

const findTextChange = (before: string, after: string): TextChange => {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  ) suffix += 1
  return {
    oldStart: prefix,
    oldEnd: before.length - suffix,
    newStart: prefix,
    newEnd: after.length - suffix
  }
}

const mapOffset = (offset: number, change: TextChange, bias: 'start' | 'end'): number => {
  const delta = (change.newEnd - change.newStart) - (change.oldEnd - change.oldStart)
  if (offset <= change.oldStart) return offset
  if (offset >= change.oldEnd) return offset + delta
  return bias === 'start' ? change.newStart : change.newEnd
}

const moveRange = (range: AiChangeRange, before: string, after: string): AiChangeRange => {
  const change = findTextChange(before, after)
  if (change.oldStart === change.oldEnd && change.newStart === change.newEnd) return range

  let startOffset: number
  let endOffset: number
  if (range.endOffset <= change.oldStart) {
    startOffset = range.startOffset
    endOffset = range.endOffset
  } else if (range.startOffset >= change.oldEnd) {
    startOffset = mapOffset(range.startOffset, change, 'start')
    endOffset = mapOffset(range.endOffset, change, 'end')
  } else {
    startOffset = Math.min(range.startOffset, change.newStart)
    endOffset = Math.max(change.newEnd, mapOffset(range.endOffset, change, 'end'))
  }
  return normalizeRange(after, startOffset, endOffset)
}

export class AiChangeTracker {
  private readonly markers = new Map<string, AiChangeMarker>()

  get(tabId: string): AiChangeMarker | undefined {
    return this.markers.get(tabId)
  }

  apply(tabId: string, revisionId: string, beforeMarkdown: string, afterMarkdown: string, ranges: AiChangeRange[]): AiChangeMarker {
    const marker: AiChangeMarker = {
      revisionId,
      status: 'unsaved',
      beforeMarkdown,
      afterMarkdown,
      currentMarkdown: afterMarkdown,
      visible: true,
      ranges: ranges.length ? ranges : fullDocumentRange(afterMarkdown)
    }
    this.markers.set(tabId, marker)
    return marker
  }

  markSaved(tabId: string): AiChangeMarker | undefined {
    const marker = this.markers.get(tabId)
    if (marker) marker.status = 'saved'
    return marker
  }

  clear(tabId: string): void {
    this.markers.delete(tabId)
  }

  updateDocument(tabId: string, markdown: string): AiChangeMarker | undefined {
    const marker = this.markers.get(tabId)
    if (!marker || markdown === marker.currentMarkdown) return marker

    if (markdown === marker.beforeMarkdown) {
      marker.currentMarkdown = markdown
      marker.visible = false
      return marker
    }
    if (markdown === marker.afterMarkdown) {
      marker.currentMarkdown = markdown
      marker.visible = true
      return marker
    }

    if (!marker.visible) {
      marker.currentMarkdown = markdown
      return marker
    }

    marker.ranges = marker.ranges.map(range => moveRange(range, marker.currentMarkdown, markdown))
    marker.currentMarkdown = markdown
    marker.visible = true
    return marker
  }
}
