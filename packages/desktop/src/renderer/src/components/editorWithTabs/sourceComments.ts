import { markdownToTextBlocks } from '@muyajs/core'
import {
  locateBlocksInSource,
  selectionFromSource,
  type SourcePoint
} from '@/agent/anchoring'
import type { AnchorRange } from '@/agent/anchoring/anchor'
import { commentDecorations, type CommentDecorationInput } from './commentSession'

export interface SourceCommentMark {
  id: string
  from: SourcePoint
  to: SourcePoint
  className: string
}

const classNameFor = (active: boolean, draft: boolean): string => {
  if (draft) return 'mt-comment mt-comment-draft'
  if (active) return 'mt-comment mt-comment-active'
  return 'mt-comment'
}

/**
 * Map comment decorations onto CodeMirror positions. `offsetToSource` is null
 * only for syntax the locator cannot place; the block's line span is the
 * fallback so the mark still shows.
 */
export function sourceCommentMarks(
  input: CommentDecorationInput,
  markdown: string
): SourceCommentMark[] {
  const located = locateBlocksInSource(markdown, markdownToTextBlocks(markdown))
  const marks: SourceCommentMark[] = []

  for (const decoration of commentDecorations(input)) {
    const block = located.find((item) => item.index === decoration.blockIndex)
    if (!block) continue

    let from = block.offsetToSource(decoration.start)
    let to = block.offsetToSource(decoration.end)
    if (!from || !to) {
      from = { line: block.startLine, ch: 0 }
      to = { line: block.endLine, ch: Number.MAX_SAFE_INTEGER }
    }

    if (from.line === to.line && from.ch === to.ch) continue

    marks.push({
      id: decoration.id,
      from,
      to,
      className: classNameFor(decoration.active, decoration.draft === true)
    })
  }

  return marks
}

/** `null` when the caret is collapsed or the ends are not in one text block. */
export function sourceSelectionRange(
  markdown: string,
  anchor: SourcePoint,
  head: SourcePoint
): AnchorRange | null {
  const located = locateBlocksInSource(markdown, markdownToTextBlocks(markdown))
  return selectionFromSource(located, anchor, head)
}
