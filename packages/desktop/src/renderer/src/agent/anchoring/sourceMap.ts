import type { ITextBlockInfo } from '@muyajs/core'
import type { AnchorRange } from './anchor'

/** 0-based, matching CodeMirror's `{ line, ch }`. Display line numbers add 1. */
export interface SourcePoint {
  line: number
  ch: number
}

export interface LocatedBlock {
  index: number
  /** Inclusive source lines the block occupies, including a setext underline or a code fence. */
  startLine: number
  endLine: number
  /**
   * Block-text offset → source point. `null` when the offset cannot be placed
   * (rare syntax). The thread stays anchored; paint `startLine`..`endLine` instead.
   * `offset === text.length` is the exclusive end.
   */
  offsetToSource(offset: number): SourcePoint | null
  /** `null` when `point` sits outside this block's text, such as on a list marker. */
  offsetAt(point: SourcePoint): number | null
}

interface Cursor {
  line: number
  ch: number
}

interface Piece {
  line: number
  ch: number
  length: number
}

const BLOCKQUOTE = /^(?:> ?)/
const LIST_MARKER = /^ {0,7}(?:[-+*]|\d{1,9}[.)]) +(?:\[[ xX]\] )?/
const TABLE_PIPE = /^ *\| */
const ONLY_SPACES = /^ *$/

/**
 * Container syntax that may sit before block text on a source line: quote
 * markers, list markers (including a task box), table pipes, and indent.
 * Anything else means the match is inside other words.
 */
const isAffix = (value: string): boolean => {
  let rest = value
  for (let guard = 0; guard < 8 && rest.length > 0; guard++) {
    if (ONLY_SPACES.test(rest)) return true
    if (BLOCKQUOTE.test(rest)) {
      rest = rest.replace(BLOCKQUOTE, '')
      continue
    }
    if (LIST_MARKER.test(rest)) {
      rest = rest.replace(LIST_MARKER, '')
      continue
    }
    if (TABLE_PIPE.test(rest)) {
      rest = rest.replace(TABLE_PIPE, '')
      continue
    }
    return false
  }
  return ONLY_SPACES.test(rest)
}

const boundaryAfter = (line: string, end: number): boolean => {
  if (end >= line.length) return true
  const next = line[end]
  return next === ' ' || next === '\t' || next === '|' || next === '>'
}

const sourceLinesOf = (markdown: string): string[] => {
  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

const findInLine = (line: string, fromCh: number, blockLine: string): number | null => {
  if (blockLine.length === 0) {
    if (fromCh === 0 && isAffix(line)) return line.length
    return null
  }

  let from = fromCh
  while (from <= line.length) {
    const at = line.indexOf(blockLine, from)
    if (at < 0) return null
    if (isAffix(line.slice(fromCh, at)) && boundaryAfter(line, at + blockLine.length)) return at
    from = at + 1
  }
  return null
}

const findForward = (
  lines: readonly string[],
  cursor: Cursor,
  blockLine: string
): SourcePoint | null => {
  for (let line = cursor.line; line < lines.length; line++) {
    const fromCh = line === cursor.line ? cursor.ch : 0
    const ch = findInLine(lines[line] ?? '', fromCh, blockLine)
    if (ch != null) return { line, ch }
  }
  return null
}

const isSetextUnderline = (line: string): boolean => {
  const content = line.replace(/^(?:> ?)*/, '')
  return /^ {0,3}(?:=+|-+)[ \t]*$/.test(content)
}

const isFence = (line: string): boolean => {
  const content = line.replace(/^(?:> ?)*/, '')
  return /^ {0,3}(?:`{3,}|~{3,})/.test(content)
}

const pointKey = (point: SourcePoint): string => `${point.line}:${point.ch}`

const samePoint = (left: SourcePoint, right: SourcePoint): boolean =>
  left.line === right.line && left.ch === right.ch

const mapPieces = (pieces: readonly Piece[], textLength: number) => {
  const points = new Map<string, number>()

  const offsetToSource = (offset: number): SourcePoint | null => {
    if (offset < 0 || offset > textLength) return null
    let consumed = 0
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]
      if (!piece) continue
      if (offset <= consumed + piece.length) {
        return { line: piece.line, ch: piece.ch + (offset - consumed) }
      }
      consumed += piece.length + 1
    }
    return null
  }

  for (let offset = 0; offset <= textLength; offset++) {
    const point = offsetToSource(offset)
    if (!point || points.has(pointKey(point))) continue
    points.set(pointKey(point), offset)
  }

  const offsetAt = (point: SourcePoint): number | null => points.get(pointKey(point)) ?? null

  return { offsetToSource, offsetAt }
}

const failedBlock = (block: ITextBlockInfo, cursor: Cursor, lineCount: number): LocatedBlock => {
  const startLine = Math.min(cursor.line, Math.max(lineCount - 1, 0))
  const span = Math.max(block.text.split('\n').length, 1)
  const endLine = Math.min(Math.max(lineCount - 1, 0), startLine + span - 1)
  return {
    index: block.index,
    startLine,
    endLine,
    offsetToSource: () => null,
    offsetAt: () => null
  }
}

/**
 * Place each text block into `markdown`. Search continues forward, and a source
 * line matches when the block line sits after container prefixes. Character
 * positions that cannot be placed come back as `null`; the line span is still
 * the block, so a highlight can cover it without orphaning the thread.
 */
export const locateBlocksInSource = (
  markdown: string,
  blocks: readonly ITextBlockInfo[]
): LocatedBlock[] => {
  const lines = sourceLinesOf(markdown)
  const cursor: Cursor = { line: 0, ch: 0 }
  const located: LocatedBlock[] = []

  for (const block of blocks) {
    const blockLines = block.text.split('\n')
    const pieces: Piece[] = []
    let placed = true

    for (const blockLine of blockLines) {
      const found = findForward(lines, cursor, blockLine)
      if (!found) {
        placed = false
        break
      }
      pieces.push({ line: found.line, ch: found.ch, length: blockLine.length })
      const sourceLine = lines[found.line] ?? ''
      const after = sourceLine.slice(found.ch + blockLine.length)
      if (isAffix(after)) {
        cursor.line = found.line + 1
        cursor.ch = 0
      } else {
        cursor.line = found.line
        cursor.ch = found.ch + blockLine.length
      }
    }

    if (!placed || pieces.length === 0) {
      located.push(failedBlock(block, cursor, lines.length))
      cursor.line = Math.min(lines.length, cursor.line + 1)
      cursor.ch = 0
      continue
    }

    const first = pieces[0]
    const last = pieces[pieces.length - 1]
    if (!first || !last) continue

    let startLine = first.line
    let endLine = last.line

    if (block.type === 'setextheading' && cursor.line < lines.length && isSetextUnderline(lines[cursor.line] ?? '')) {
      endLine = cursor.line
      cursor.line += 1
      cursor.ch = 0
    }

    if (block.type === 'codeblock') {
      if (startLine > 0 && isFence(lines[startLine - 1] ?? '')) startLine -= 1
      if (cursor.line < lines.length && isFence(lines[cursor.line] ?? '')) {
        endLine = cursor.line
        cursor.line += 1
        cursor.ch = 0
      }
    }

    const mapped = mapPieces(pieces, block.text.length)
    located.push({
      index: block.index,
      startLine,
      endLine,
      offsetToSource: mapped.offsetToSource,
      offsetAt: mapped.offsetAt
    })
  }

  return located
}

/**
 * CodeMirror selection → one block range. `null` when the caret is collapsed,
 * the ends lie in different blocks, or either end is outside the block text
 * (a list marker, a fence, a table pipe).
 */
export const selectionFromSource = (
  located: readonly LocatedBlock[],
  anchor: SourcePoint,
  head: SourcePoint
): AnchorRange | null => {
  if (samePoint(anchor, head)) return null

  let startHit: { index: number; offset: number } | null = null
  let endHit: { index: number; offset: number } | null = null

  for (const block of located) {
    const start = block.offsetAt(anchor)
    const end = block.offsetAt(head)
    if (start != null && startHit == null) startHit = { index: block.index, offset: start }
    if (end != null && endHit == null) endHit = { index: block.index, offset: end }
  }

  if (!startHit || !endHit || startHit.index !== endHit.index) return null

  const start = Math.min(startHit.offset, endHit.offset)
  const end = Math.max(startHit.offset, endHit.offset)
  if (start === end) return null

  return { index: startHit.index, start, end }
}
