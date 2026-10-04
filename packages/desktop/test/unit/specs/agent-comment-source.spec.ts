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

import { startCommentFromRange } from '@/components/editorWithTabs/commentSession'
import { sourceCommentMarks, sourceSelectionRange } from '@/components/editorWithTabs/sourceComments'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph.\n'

const thread = (id: string, status: Thread['status'] = 'open'): Thread => ({
  id,
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  closedAt: status === 'closed' ? '2026-01-02T00:00:00.000Z' : null,
  anchor: {
    quote: 'strict',
    prefix: 'Alpha ',
    suffix: ' phrase.',
    blockHint: { type: 'paragraph', index: 0 }
  },
  messages: []
})

describe('source comment marks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('places an active mark on the quote and skips a closed thread', () => {
    const marks = sourceCommentMarks(
      {
        threads: [thread('t1'), thread('shut', 'closed')],
        resolved: new Map([
          ['t1', { status: 'anchored', index: 0, start: 6, end: 12 }],
          ['shut', { status: 'anchored', index: 1, start: 0, end: 4 }]
        ]),
        selectedThreadId: 't1',
        showClosed: false,
        draft: null
      },
      MARKDOWN
    )

    expect(marks).toEqual([
      {
        id: 't1',
        from: { line: 0, ch: 6 },
        to: { line: 0, ch: 12 },
        className: 'mt-comment mt-comment-active'
      }
    ])
  })

  it('drops a thread whose quote is no longer in the file', () => {
    const marks = sourceCommentMarks(
      {
        threads: [thread('t1')],
        resolved: new Map([['t1', { status: 'orphaned' }]]),
        selectedThreadId: 't1',
        showClosed: false,
        draft: { index: 0, start: 0, end: 5 }
      },
      MARKDOWN
    )

    expect(marks).toEqual([
      {
        id: 'comment-draft',
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 5 },
        className: 'mt-comment mt-comment-draft'
      }
    ])
  })

  it('refuses a selection that crosses two paragraphs', () => {
    expect(
      sourceSelectionRange(MARKDOWN, { line: 0, ch: 0 }, { line: 2, ch: 4 })
    ).toBeNull()
    expect(
      sourceSelectionRange(MARKDOWN, { line: 0, ch: 6 }, { line: 0, ch: 12 })
    ).toEqual({ index: 0, start: 6, end: 12 })

    useAgentStore().repoState = { kind: 'repo', root: '/repo', userName: 'Ada' }
    const comments = useCommentsStore()
    comments.availability = { kind: 'ready', file: 'guide.md' }

    expect(startCommentFromRange([], null)).toEqual({ kind: 'blocked' })
    expect(comments.draft).toBeNull()

    expect(
      startCommentFromRange(
        [{ index: 0, type: 'paragraph', text: 'Alpha strict phrase.' }],
        { index: 0, start: 6, end: 12 }
      )
    ).toEqual({ kind: 'started' })
    expect(comments.draft?.quote).toBe('strict')
    expect(useLayoutStore().agentPanelTab).toBe('comments')
  })
})
