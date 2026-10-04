import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Thread } from '@shared/types/comments'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.path = {
    sep: '/',
    dirname: (p: string) => p,
    relative: (from: string, to: string) => to,
    isAbsolute: (p: string) => p.startsWith('/')
  }
  w.window.fileUtils = {
    hasMarkdownExtension: (name: string) => name.toLowerCase().endsWith('.md')
  }
  w.window.electron = {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { commentDecorations, startCommentDraft } from '@/components/editorWithTabs/commentSession'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'

const thread = (id: string, status: Thread['status']): Thread => ({
  id,
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  closedAt: status === 'closed' ? '2026-01-02T00:00:00.000Z' : null,
  anchor: {
    quote: id,
    prefix: '',
    suffix: '',
    blockHint: { type: 'paragraph', index: 0 }
  },
  messages: []
})

describe('WYSIWYG comment marks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('paints open anchored threads, the selection, and a draft', () => {
    const marks = commentDecorations({
      threads: [thread('open', 'open'), thread('shut', 'closed'), thread('loose', 'open')],
      resolved: new Map([
        ['open', { status: 'anchored', index: 1, start: 2, end: 6 }],
        ['shut', { status: 'anchored', index: 2, start: 0, end: 3 }],
        ['loose', { status: 'orphaned' }]
      ]),
      selectedThreadId: 'open',
      showClosed: false,
      draft: { index: 0, start: 1, end: 4 }
    })

    expect(marks).toEqual([
      { id: 'open', blockIndex: 1, start: 2, end: 6, active: true },
      {
        id: 'comment-draft',
        blockIndex: 0,
        start: 1,
        end: 4,
        active: false,
        draft: true
      }
    ])
  })

  it('includes a closed thread only while closed marks are shown', () => {
    const input = {
      threads: [thread('shut', 'closed')],
      resolved: new Map([['shut', { status: 'anchored' as const, index: 0, start: 0, end: 2 }]]),
      selectedThreadId: null,
      showClosed: true,
      draft: null
    }

    expect(commentDecorations({ ...input, showClosed: false })).toEqual([])
    expect(commentDecorations(input)).toEqual([
      { id: 'shut', blockIndex: 0, start: 0, end: 2, active: false }
    ])
  })

  it('opens a draft from an in-block selection and refuses one that crosses a block', () => {
    useAgentStore().repoState = { kind: 'repo', root: '/repo', userName: 'Ada' }
    const comments = useCommentsStore()
    comments.availability = { kind: 'ready', file: 'docs/guide.md' }
    const blocks = [{ index: 0, type: 'paragraph', text: 'hello world' }]

    expect(
      startCommentDraft({
        getSelectionInBlock: () => null,
        getTextBlocks: () => blocks
      })
    ).toEqual({ kind: 'blocked' })
    expect(comments.draft).toBeNull()

    expect(
      startCommentDraft({
        getSelectionInBlock: () => ({ index: 0, start: 0, end: 5, text: 'hello' }),
        getTextBlocks: () => blocks
      })
    ).toEqual({ kind: 'started' })
    expect(comments.draft?.quote).toBe('hello')
    expect(comments.draft?.anchor.quote).toBe('hello')
    expect(comments.selectedThreadId).toBeNull()
    expect(useLayoutStore().showAgentPanel).toBe(true)
    expect(useLayoutStore().agentPanelTab).toBe('comments')
  })
})
