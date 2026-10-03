import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { CommentsFile, Thread } from '@shared/types/comments'
import { REANCHOR_DEBOUNCE_MS } from '@shared/types/comments'
import type { RepoState } from '@shared/types/agent'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.path = {
    sep: '/',
    dirname: (p: string) => p,
    relative(from: string, to: string) {
      if (to === from) return ''
      const prefix = from.endsWith('/') ? from : `${from}/`
      if (to.startsWith(prefix)) return to.slice(prefix.length)
      return `../${to}`
    },
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

import bus from '@/bus'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'

const win = window as unknown as {
  comments: {
    load: Mock
    mutate: Mock
    onChanged: Mock
  }
}

const repo: RepoState = { kind: 'repo', root: '/repo', userName: 'Ada' }

const thread = (id: string, quote: string): Thread => ({
  id,
  status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z',
  closedAt: null,
  anchor: {
    quote,
    prefix: '',
    suffix: '',
    blockHint: { type: 'paragraph', index: 0 }
  },
  messages: [
    {
      id: `${id}-m`,
      author: { kind: 'human', name: 'Ada' },
      text: 'note',
      createdAt: '2026-01-01T00:00:00.000Z',
      editedAt: null
    }
  ]
})

const commentsFile = (file: string, threads: Thread[]): CommentsFile => ({
  version: 1,
  file,
  threads
})

const guide = commentsFile('docs/guide.md', [thread('t1', 'quote')])

describe('comments store', () => {
  let load: Mock
  let mutate: Mock
  let onChanged: Mock

  const emitChanged = (file: string): void => {
    const listener = onChanged.mock.calls[0]?.[0] as
      | ((payload: { file: string }) => void)
      | undefined
    listener?.({ file })
  }

  const open = async(
    pathname: string,
    markdown: string,
    filename = pathname.slice(pathname.lastIndexOf('/') + 1)
  ): Promise<void> => {
    useAgentStore().repoState = repo
    useEditorStore().currentFile = {
      id: 'tab-1',
      filename,
      pathname,
      markdown
    } as ReturnType<typeof useEditorStore>['currentFile']
    useCommentsStore().listen()
    await vi.waitFor(() => {
      expect(load).toHaveBeenCalled()
    })
    await load.mock.results.at(-1)?.value
    await nextTick()
  }

  beforeEach(() => {
    load = vi.fn((file: string) =>
      Promise.resolve({
        kind: 'ok',
        file: file === 'docs/guide.md' ? guide : commentsFile(file, [])
      })
    )
    mutate = vi.fn()
    onChanged = vi.fn(() => vi.fn())
    win.comments = { load, mutate, onChanged }
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useCommentsStore().stop()
    vi.useRealTimers()
  })

  it('does not load comments for an untitled tab, a file outside the repo, or a non-markdown file', async() => {
    const store = useCommentsStore()
    const editor = useEditorStore()
    useAgentStore().repoState = repo
    store.listen()

    editor.currentFile = {
      id: 'tab-1',
      filename: 'Untitled',
      pathname: '',
      markdown: 'alpha quote beta\n'
    } as ReturnType<typeof useEditorStore>['currentFile']
    await nextTick()
    expect(store.availability).toEqual({ kind: 'unavailable', reason: 'untitled' })
    expect(store.hintKey).toBe('comments.unavailableUntitled')

    editor.currentFile = {
      id: 'tab-2',
      filename: 'note.md',
      pathname: '/other/note.md',
      markdown: 'alpha quote beta\n'
    } as ReturnType<typeof useEditorStore>['currentFile']
    await nextTick()
    expect(store.availability).toEqual({ kind: 'unavailable', reason: 'outside' })
    expect(store.hintKey).toBe('comments.unavailableOutside')

    editor.currentFile = {
      id: 'tab-3',
      filename: 'notes.txt',
      pathname: '/repo/notes.txt',
      markdown: 'alpha quote beta\n'
    } as ReturnType<typeof useEditorStore>['currentFile']
    await nextTick()
    expect(store.availability).toEqual({ kind: 'unavailable', reason: 'not-markdown' })
    expect(store.hintKey).toBe('comments.unavailableMarkdown')
    expect(load).not.toHaveBeenCalled()
    expect(store.threads).toEqual([])
  })

  it('loads the current file on tab change and again when that file’s comments change', async() => {
    const store = useCommentsStore()
    await open('/repo/docs/guide.md', 'alpha quote beta\n')

    expect(load).toHaveBeenCalledWith('docs/guide.md')
    expect(store.availability).toEqual({ kind: 'ready', file: 'docs/guide.md' })
    expect(store.threads).toEqual(guide.threads)
    expect(store.resolved.get('t1')).toMatchObject({ status: 'anchored' })
    expect(store.showClosed).toBe(false)
    expect(store.unresolvedCount).toBe(1)

    store.selectedThreadId = 't1'
    emitChanged('README.md')
    await nextTick()
    expect(load).toHaveBeenCalledTimes(1)

    load.mockResolvedValueOnce({
      kind: 'ok',
      file: commentsFile('docs/guide.md', [thread('t1', 'quote'), thread('t2', 'beta')])
    })
    emitChanged('docs/guide.md')
    await vi.waitFor(() => {
      expect(store.threads.map((item) => item.id)).toEqual(['t1', 't2'])
    })
    expect(store.selectedThreadId).toBe('t1')

    useEditorStore().currentFile = {
      id: 'tab-2',
      filename: 'README.md',
      pathname: '/repo/README.md',
      markdown: 'readme\n'
    } as ReturnType<typeof useEditorStore>['currentFile']
    await vi.waitFor(() => {
      expect(store.availability).toEqual({ kind: 'ready', file: 'README.md' })
    })
    expect(store.threads).toEqual([])
    expect(store.selectedThreadId).toBeNull()
  })

  it('keeps a parse error and refuses writes until the file loads again', async() => {
    load.mockResolvedValue({
      kind: 'parse_error',
      path: '/repo/.marktext/comments/docs/guide.md.json',
      message: 'Unexpected token'
    })
    const store = useCommentsStore()
    await open('/repo/docs/guide.md', 'alpha quote beta\n')

    expect(store.parseError).toEqual({
      path: '/repo/.marktext/comments/docs/guide.md.json',
      message: 'Unexpected token'
    })
    expect(store.threads).toEqual([])
    await expect(store.setStatus('t1', 'closed')).rejects.toThrow(/unreadable/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('replaces threads with the mutate response and leaves them unchanged until it arrives', async() => {
    const store = useCommentsStore()
    await open('/repo/docs/guide.md', 'alpha quote beta\n')

    let resolveMutate: (file: CommentsFile) => void = () => {}
    mutate.mockImplementation(
      () =>
        new Promise<CommentsFile>((resolve) => {
          resolveMutate = resolve
        })
    )

    const pending = store.addHumanMessage('t1', 'more')
    await Promise.resolve()
    expect(store.threads).toEqual(guide.threads)
    expect(mutate).toHaveBeenCalledWith({ op: 'addHumanMessage', threadId: 't1', text: 'more' })

    const updated = commentsFile('docs/guide.md', [
      {
        ...thread('t1', 'quote'),
        messages: [
          ...thread('t1', 'quote').messages,
          {
            id: 't1-m2',
            author: { kind: 'human', name: 'Ada' },
            text: 'more',
            createdAt: '2026-01-02T00:00:00.000Z',
            editedAt: null
          }
        ]
      }
    ])
    resolveMutate(updated)
    await pending
    expect(store.threads).toEqual(updated.threads)

    mutate.mockRejectedValueOnce(new Error('disk full'))
    await expect(store.deleteThread('t1')).rejects.toThrow(/disk full/)
    expect(store.threads).toEqual(updated.threads)
  })

  it('reanchors when the file loads, immediately after an external reload, and after typing settles', async() => {
    const store = useCommentsStore()
    await open('/repo/docs/guide.md', 'alpha quote beta\n')
    expect(store.resolved.get('t1')?.status).toBe('anchored')

    const current = useEditorStore().currentFile
    if (!current) throw new Error('expected an open file')
    current.markdown = 'alpha beta\n'
    bus.emit('file-changed', { id: current.id, markdown: 'alpha beta\n', isReload: true })
    expect(store.resolved.get('t1')?.status).toBe('orphaned')

    current.markdown = 'alpha quote beta\n'
    bus.emit('file-changed', { id: current.id, markdown: 'alpha quote beta\n', isReload: true })
    expect(store.resolved.get('t1')?.status).toBe('anchored')

    vi.useFakeTimers()
    current.markdown = 'gone\n'
    await nextTick()
    expect(store.resolved.get('t1')?.status).toBe('anchored')
    await vi.advanceTimersByTimeAsync(REANCHOR_DEBOUNCE_MS - 1)
    expect(store.resolved.get('t1')?.status).toBe('anchored')
    await vi.advanceTimersByTimeAsync(1)
    expect(store.resolved.get('t1')?.status).toBe('orphaned')
  })

  it('takes missing replies from the latest finished turn', async() => {
    const store = useCommentsStore()
    store.listen()
    const agent = useAgentStore()

    agent.events.push({
      type: 'turn_finished',
      turnId: 'turn-1',
      stopReason: 'end_turn',
      changedPaths: [],
      missingReplyThreadIds: ['t1', 't2']
    })
    await nextTick()
    expect([...store.missingReply].sort()).toEqual(['t1', 't2'])

    agent.events.push({ type: 'turn_started', turnId: 'turn-2' })
    await nextTick()
    expect([...store.missingReply].sort()).toEqual(['t1', 't2'])

    agent.events.push({
      type: 'turn_finished',
      turnId: 'turn-2',
      stopReason: 'end_turn',
      changedPaths: [],
      missingReplyThreadIds: []
    })
    await nextTick()
    expect(store.missingReply.size).toBe(0)
  })
})
