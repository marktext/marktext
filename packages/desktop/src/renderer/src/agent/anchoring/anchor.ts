import type { ITextBlockInfo } from '@muyajs/core'
import { ANCHOR_CONTEXT_CHARS, type Anchor } from '@shared/types/comments'

/** UTF-16 offsets into one text block. `end` is exclusive, same as `block.text.slice`. */
export interface AnchorRange {
  index: number
  start: number
  end: number
}

export type AnchorResolution =
  | { status: 'anchored'; index: number; start: number; end: number }
  | { status: 'orphaned' }

export class AnchorCaptureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnchorCaptureError'
  }
}

interface Occurrence {
  block: ITextBlockInfo
  start: number
}

/**
 * `range.index` is the text-block index (`ITextBlockInfo.index`).
 * `blockHint.index` is not: it counts blocks of the same `type` from the
 * start of the file. Throws when the slice is empty or the range is not
 * inside that block.
 */
export const captureAnchor = (blocks: readonly ITextBlockInfo[], range: AnchorRange): Anchor => {
  const block = blocks.find((item) => item.index === range.index)
  if (!block) throw new AnchorCaptureError('text block is not in the document')
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    throw new AnchorCaptureError('quote offsets must be integers')
  }
  if (range.start < 0 || range.end > block.text.length || range.start >= range.end) {
    throw new AnchorCaptureError('comment quote is empty')
  }

  const quote = block.text.slice(range.start, range.end)
  const prefix = block.text.slice(Math.max(0, range.start - ANCHOR_CONTEXT_CHARS), range.start)
  const suffix = block.text.slice(range.end, range.end + ANCHOR_CONTEXT_CHARS)

  return {
    quote,
    prefix,
    suffix,
    blockHint: {
      type: block.type,
      index: typeIndex(blocks, block)
    }
  }
}

/**
 * Strict search for `anchor.quote`. One hit is enough. Several hits are
 * kept only when the text before ends with `prefix` and the text after
 * starts with `suffix`. A remaining tie is kept only when exactly one hit
 * sits in the hinted block. Anything else is orphaned, including an empty quote.
 */
export const resolveAnchor = (
  blocks: readonly ITextBlockInfo[],
  anchor: Anchor
): AnchorResolution => {
  if (anchor.quote.length === 0) return { status: 'orphaned' }

  const hits = occurrences(blocks, anchor.quote)
  const chosen = hits.length > 1 ? narrow(blocks, hits, anchor) : hits
  const hit = chosen.length === 1 ? chosen[0] : undefined
  if (!hit) return { status: 'orphaned' }

  return {
    status: 'anchored',
    index: hit.block.index,
    start: hit.start,
    end: hit.start + anchor.quote.length
  }
}

const typeIndex = (blocks: readonly ITextBlockInfo[], block: ITextBlockInfo): number => {
  let count = 0
  for (const item of blocks) {
    if (item.index === block.index) return count
    if (item.type === block.type) count += 1
  }
  return count
}

const occurrences = (blocks: readonly ITextBlockInfo[], quote: string): Occurrence[] => {
  const hits: Occurrence[] = []
  for (const block of blocks) {
    let from = 0
    while (from <= block.text.length - quote.length) {
      const at = block.text.indexOf(quote, from)
      if (at < 0) break
      hits.push({ block, start: at })
      from = at + 1
    }
  }
  return hits
}

const narrow = (
  blocks: readonly ITextBlockInfo[],
  hits: readonly Occurrence[],
  anchor: Anchor
): Occurrence[] => {
  const inContext = hits.filter((hit) => contextMatches(hit, anchor))
  if (inContext.length <= 1) return inContext

  const hinted = inContext.filter((hit) => {
    return hit.block.type === anchor.blockHint.type && typeIndex(blocks, hit.block) === anchor.blockHint.index
  })
  return hinted.length === 1 ? hinted : []
}

const contextMatches = (hit: Occurrence, anchor: Anchor): boolean => {
  const before = hit.block.text.slice(0, hit.start)
  const after = hit.block.text.slice(hit.start + anchor.quote.length)
  return before.endsWith(anchor.prefix) && after.startsWith(anchor.suffix)
}
