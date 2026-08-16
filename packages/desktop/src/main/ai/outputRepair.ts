export type AiOutputFailureCode =
  | 'contract'
  | 'exact-match'
  | 'markdown-compatibility'
  | 'truncated'
  | 'capability'
  | 'transport'
  | 'scope'

export interface MarkdownIssue {
  code: 'outer-fence' | 'inline-math-delimiter' | 'display-math-delimiter' | 'same-line-display-math' | 'math-fence' | 'unclosed-code-fence'
  message: string
}

export interface MarkdownInspection {
  issues: MarkdownIssue[]
}

export interface MarkdownNormalizationResult {
  content: string
  changes: string[]
}

interface Range {
  start: number
  end: number
}

const fenceAtLine = (line: string): { character: '`' | '~'; length: number; language: string } | undefined => {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (!match) return undefined
  return {
    character: match[1][0] as '`' | '~',
    length: match[1].length,
    language: match[2].trim().toLowerCase()
  }
}

const lineRanges = (value: string): Array<{ start: number; end: number; text: string }> => {
  const ranges: Array<{ start: number; end: number; text: string }> = []
  let start = 0
  while (start <= value.length) {
    const newline = value.indexOf('\n', start)
    const end = newline < 0 ? value.length : newline
    ranges.push({ start, end, text: value.slice(start, end) })
    if (newline < 0) break
    start = newline + 1
  }
  return ranges
}

const protectedRanges = (value: string): { ranges: Range[]; unclosedFence: boolean; mathFenceRanges: Range[] } => {
  const lines = lineRanges(value)
  const ranges: Range[] = []
  const mathFenceRanges: Range[] = []
  let fence: { character: '`' | '~'; length: number; start: number; math: boolean } | undefined
  let frontMatter = false
  let frontMatterStart = 0

  for (const line of lines) {
    const marker = fenceAtLine(line.text)
    if (fence) {
      if (marker && marker.character === fence.character && marker.length >= fence.length) {
        const end = line.end + (line.end < value.length ? 1 : 0)
        ranges.push({ start: fence.start, end })
        if (fence.math) mathFenceRanges.push({ start: fence.start, end })
        fence = undefined
      }
      continue
    }
    if (!frontMatter && line.start === 0 && /^---\s*$/.test(line.text)) {
      frontMatter = true
      frontMatterStart = line.start
      continue
    }
    if (frontMatter) {
      if (/^(---|\.\.\.)\s*$/.test(line.text) && line.start !== frontMatterStart) {
        ranges.push({ start: frontMatterStart, end: line.end + (line.end < value.length ? 1 : 0) })
        frontMatter = false
      }
      continue
    }
    if (marker) {
      fence = {
        character: marker.character,
        length: marker.length,
        start: line.start,
        math: marker.language === 'math'
      }
    }
  }
  if (frontMatter) ranges.push({ start: frontMatterStart, end: value.length })
  return { ranges, unclosedFence: !!fence, mathFenceRanges }
}

const addInlineCodeRanges = (value: string, ranges: Range[]): Range[] => {
  const result = [...ranges]
  let index = 0
  while (index < value.length) {
    if (ranges.some(range => index >= range.start && index < range.end)) {
      index += 1
      continue
    }
    if (value[index] !== '`') {
      index += 1
      continue
    }
    let length = 1
    while (value[index + length] === '`') length += 1
    const close = value.indexOf('`'.repeat(length), index + length)
    if (close >= 0) {
      result.push({ start: index, end: close + length })
      index = close + length
    } else {
      index += length
    }
  }
  return result.sort((left, right) => left.start - right.start)
}

const inspectUnprotected = (value: string, ranges: Range[]): MarkdownIssue[] => {
  const issues: MarkdownIssue[] = []
  const segments: string[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) segments.push(value.slice(cursor, range.start))
    cursor = Math.max(cursor, range.end)
  }
  if (cursor < value.length) segments.push(value.slice(cursor))
  const plain = segments.join('\n')
  if (/\\\((?:.|\n)*?\\\)/.test(plain)) {
    issues.push({ code: 'inline-math-delimiter', message: 'Inline math uses \\( ... \\) delimiters.' })
  }
  if (/\\\[(?:.|\n)*?\\\]/.test(plain)) {
    issues.push({ code: 'display-math-delimiter', message: 'Display math uses \\[ ... \\] delimiters.' })
  }
  for (const line of plain.split('\n')) {
    if (/^\s*\$\$\s*.+?\s*\$\$\s*$/.test(line)) {
      issues.push({ code: 'same-line-display-math', message: 'Display math uses same-line $$ delimiters.' })
      break
    }
  }
  return issues
}

export const inspectMarkdown = (value: string): MarkdownInspection => {
  const content = value.replaceAll('\r\n', '\n')
  const issues: MarkdownIssue[] = []
  const lines = lineRanges(content)
  const first = lines.find(line => line.text.trim())?.text.trim() ?? ''
  const last = [...lines].reverse().find(line => line.text.trim())?.text.trim() ?? ''
  if (/^(`{3,}|~{3,})/.test(first) && /(`{3,}|~{3,})$/.test(last)) {
    issues.push({ code: 'outer-fence', message: 'The complete Markdown document is wrapped in a code fence.' })
  }
  const fenceInfo = protectedRanges(content)
  if (fenceInfo.unclosedFence) {
    issues.push({ code: 'unclosed-code-fence', message: 'The Markdown contains an unclosed code fence.' })
  }
  if (fenceInfo.mathFenceRanges.length) {
    issues.push({ code: 'math-fence', message: 'Math is written using a ```math fence.' })
  }
  issues.push(...inspectUnprotected(content, addInlineCodeRanges(content, fenceInfo.ranges)))
  return { issues }
}

const stripOuterFence = (value: string): string => {
  const content = value.replaceAll('\r\n', '\n').trim()
  const lines = content.split('\n')
  if (lines.length < 3 || !/^\s*(`{3,}|~{3,})[^`~]*\s*$/.test(lines[0])) return value
  const opening = lines[0].trim()[0]
  const closing = lines[lines.length - 1].trim()
  if (closing[0] !== opening || !new RegExp(`^${opening}{3,}$`).test(closing)) return value
  return lines.slice(1, -1).join('\n').trim()
}

const normalizePlainMath = (value: string): string => {
  let result = value
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_match, formula: string) => `\n\n$$\n${formula.trim()}\n$$\n\n`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`)
  result = result.replace(/^\s*\$\$\s*(\S[\s\S]*?\S)\s*\$\$\s*$/gm, (_match, formula: string) => `\n\n$$\n${formula}\n$$\n\n`)
  return result
}

const convertMathFencesOutsideCode = (value: string): { content: string; changed: boolean } => {
  const lines = value.split('\n')
  let activeFence: { character: '`' | '~'; length: number } | undefined
  let changed = false
  const output: string[] = []
  let index = 0
  while (index < lines.length) {
    const marker = fenceAtLine(lines[index])
    if (activeFence) {
      output.push(lines[index])
      if (marker && marker.character === activeFence.character && marker.length >= activeFence.length) activeFence = undefined
      index += 1
      continue
    }
    if (!marker) {
      output.push(lines[index])
      index += 1
      continue
    }
    if (marker.language === 'math' && marker.character === '`') {
      let close = index + 1
      while (close < lines.length) {
        const closing = fenceAtLine(lines[close])
        if (closing && closing.character === marker.character && closing.length >= marker.length) break
        close += 1
      }
      if (close < lines.length) {
        output.push('', '$$', ...lines.slice(index + 1, close).map(line => line.trim()), '$$', '')
        changed = true
        index = close + 1
        continue
      }
    }
    output.push(lines[index])
    activeFence = { character: marker.character, length: marker.length }
    index += 1
  }
  return { content: output.join('\n'), changed }
}

export const normalizeGeneratedMarkdown = (value: string, options: { stripOuterFence?: boolean; preserveWhitespace?: boolean } = {}): MarkdownNormalizationResult => {
  let content = value.replaceAll('\r\n', '\n')
  const changes: string[] = []
  if (options.stripOuterFence) {
    const stripped = stripOuterFence(content)
    if (stripped !== content) {
      content = stripped
      changes.push('outer-fence')
    }
  }
  const convertedMathFence = convertMathFencesOutsideCode(content)
  if (convertedMathFence.changed) {
    content = convertedMathFence.content
    changes.push('math-fence')
  }
  const fenceInfo = protectedRanges(content)
  const ranges = addInlineCodeRanges(content, fenceInfo.ranges)
  let cursor = 0
  let normalized = ''
  for (const range of ranges) {
    if (range.start < cursor) continue
    const plain = normalizePlainMath(content.slice(cursor, range.start))
    if (plain !== content.slice(cursor, range.start)) changes.push('math-delimiters')
    normalized += plain + content.slice(range.start, range.end)
    cursor = range.end
  }
  const tail = normalizePlainMath(content.slice(cursor))
  if (tail !== content.slice(cursor)) changes.push('math-delimiters')
  normalized += tail
  const result = options.preserveWhitespace ? normalized : normalized.replace(/\n{3,}/g, '\n\n').trim()
  return { content: result, changes: [...new Set(changes)] }
}

export const assertMarkdownCompatibility = (value: string): void => {
  const inspection = inspectMarkdown(value)
  if (inspection.issues.length) throw new Error(inspection.issues.map(issue => issue.message).join(' '))
}
