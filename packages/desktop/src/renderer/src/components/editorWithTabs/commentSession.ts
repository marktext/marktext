import type { IDecoration, ITextBlockInfo, ITextBlockSelection } from '@muyajs/core'
import { captureAnchor, type AnchorResolution } from '@/agent/anchoring'
import type { Thread } from '@shared/types/comments'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'

/** Not a thread id. The comments file never stores this mark. */
export const DRAFT_DECORATION_ID = 'comment-draft'

export interface CommentDecorationInput {
  threads: readonly Thread[]
  resolved: ReadonlyMap<string, AnchorResolution>
  selectedThreadId: string | null
  showClosed: boolean
  draft: { index: number; start: number; end: number } | null
}

export function commentDecorations(input: CommentDecorationInput): IDecoration[] {
  const items: IDecoration[] = []

  for (const thread of input.threads) {
    if (thread.status === 'closed' && !input.showClosed) continue
    const resolution = input.resolved.get(thread.id)
    if (!resolution || resolution.status !== 'anchored') continue
    items.push({
      id: thread.id,
      blockIndex: resolution.index,
      start: resolution.start,
      end: resolution.end,
      active: thread.id === input.selectedThreadId
    })
  }

  if (input.draft) {
    items.push({
      id: DRAFT_DECORATION_ID,
      blockIndex: input.draft.index,
      start: input.draft.start,
      end: input.draft.end,
      active: false,
      draft: true
    })
  }

  return items
}

export type CommentStart = { kind: 'started' } | { kind: 'blocked' } | { kind: 'unavailable' }

function openCommentsTab(): void {
  useLayoutStore().SET_LAYOUT({ showAgentPanel: true, agentPanelTab: 'comments' })
}

/**
 * Capture the current in-block selection into a draft and open the comments
 * tab. A selection that crosses a text block stays blocked: `captureAnchor`
 * has no range to store.
 */
export function startCommentFromRange(
  blocks: readonly ITextBlockInfo[],
  range: { index: number; start: number; end: number } | null
): CommentStart {
  if (!useAgentStore().agentAvailable) return { kind: 'unavailable' }

  const comments = useCommentsStore()
  if (comments.availability.kind !== 'ready' || comments.parseError) {
    openCommentsTab()
    return { kind: 'unavailable' }
  }

  if (!range) return { kind: 'blocked' }

  let anchor
  try {
    anchor = captureAnchor(blocks, range)
  } catch {
    return { kind: 'blocked' }
  }

  comments.openDraft({
    anchor,
    quote: anchor.quote,
    text: ''
  })
  openCommentsTab()
  return { kind: 'started' }
}

export function startCommentDraft(muya: {
  getSelectionInBlock: () => ITextBlockSelection | null
  getTextBlocks: () => ITextBlockInfo[]
}): CommentStart {
  const selection = muya.getSelectionInBlock()
  return startCommentFromRange(
    muya.getTextBlocks(),
    selection
      ? { index: selection.index, start: selection.start, end: selection.end }
      : null
  )
}
