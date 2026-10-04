import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Thread } from '@shared/types/comments'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.path = { sep: '/', dirname: (p: string) => p }
  w.window.electron = {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => () => {} }
  }
  w.window.agent = {
    getSelection: async() => ({ model: 'alpha' }),
    sendThreads: async() => ({ turnId: 'turn-1' })
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import notice from '@/services/notification'
import {
  sendCommentThreads,
  sendPending,
  sendUnavailableReason,
  threadPlacements
} from '@/agent/sendThreads'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'

const win = window as unknown as {
  electron: { ipcRenderer: { send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> } }
  agent: { sendThreads: ReturnType<typeof vi.fn>; getSelection: ReturnType<typeof vi.fn> }
}

const thread = (id: string, quote: string, status: Thread['status'] = 'open'): Thread => ({
  id,
  status,
  createdAt: '2026-10-02T15:04:00.000Z',
  closedAt: status === 'closed' ? '2026-10-02T18:00:00.000Z' : null,
  anchor: { quote, prefix: '', suffix: '', blockHint: { type: 'paragraph', index: 0 } },
  messages: [{
    id: `${id}-m`,
    author: { kind: 'human', name: 'Ada' },
    text: quote,
    createdAt: '2026-10-02T15:04:00.000Z',
    editedAt: null
  }]
})

describe('sending comment threads', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sendPending.value = false
    vi.clearAllMocks()
    win.agent.sendThreads = vi.fn(async() => ({ turnId: 'turn-1' }))
    win.agent.getSelection = vi.fn(async() => ({ model: 'alpha' }))
    win.electron.ipcRenderer.send = vi.fn()
    win.electron.ipcRenderer.on = vi.fn(() => vi.fn())
    const agent = useAgentStore()
    agent.harnessStatuses = [{
      id: 'opencode',
      found: true,
      resolvedPath: '/usr/bin/opencode',
      version: '1',
      reason: null,
      message: null
    }]
    agent.selectionModel = 'alpha'
    agent.selectionKnown = true
  })

  it('maps quotes onto 1-based lines and marks a missing quote as orphaned', () => {
    const placed = threadPlacements('Alpha strict phrase.\n\nBeta paragraph.\n', [
      thread('t-strict', 'strict'),
      thread('t-beta', 'Beta paragraph'),
      thread('t-gone', 'missing quote')
    ])
    expect(placed).toEqual([
      { threadId: 't-strict', orphaned: false, lines: { start: 1, end: 1 } },
      { threadId: 't-beta', orphaned: false, lines: { start: 3, end: 3 } },
      { threadId: 't-gone', orphaned: true }
    ])
  })

  it('names why sending is unavailable', () => {
    expect(sendUnavailableReason()).toBeNull()

    usePreferencesStore().agentModeEnabled = false
    expect(sendUnavailableReason()).toBe('mode')

    usePreferencesStore().agentModeEnabled = true
    useAgentStore().harnessStatuses = [{
      id: 'opencode',
      found: false,
      resolvedPath: null,
      version: null,
      reason: 'not_found',
      message: null
    }]
    expect(sendUnavailableReason()).toBe('harness')

    useAgentStore().harnessStatuses = [{
      id: 'opencode',
      found: true,
      resolvedPath: '/usr/bin/opencode',
      version: '1',
      reason: null,
      message: null
    }]
    useAgentStore().selectionModel = null
    expect(sendUnavailableReason()).toBe('model')

    useAgentStore().selectionModel = 'alpha'
    useAgentStore().events = [{ type: 'turn_started', turnId: 'turn-1' }]
    expect(sendUnavailableReason()).toBe('turn')
  })

  it('saves a dirty tab before sending and drops the send when saving fails', async() => {
    const comments = useCommentsStore()
    comments.availability = { kind: 'ready', file: 'guide.md' }
    comments.threads = [thread('t-strict', 'strict'), thread('t-closed', 'closed quote', 'closed')]
    const editor = useEditorStore()
    editor.currentFile = {
      id: 'tab-1',
      filename: 'guide.md',
      pathname: '/repo/guide.md',
      markdown: 'Alpha strict phrase.\n',
      isSaved: false,
      encoding: 'utf8',
      lineEnding: 'lf',
      adjustLineEndingOnSave: false,
      trimTrailingNewline: 0
    } as unknown as typeof editor.currentFile

    const saved: { fire: ((event: unknown, tabId: string) => void) | null } = { fire: null }
    win.electron.ipcRenderer.on = vi.fn((channel: string, listener: (event: unknown, tabId: string) => void) => {
      if (channel === 'mt::tab-saved') saved.fire = listener
      return vi.fn()
    })

    const pending = sendCommentThreads('all')
    await vi.waitFor(() => {
      expect(win.electron.ipcRenderer.send).toHaveBeenCalledWith(
        'mt::response-file-save',
        'tab-1',
        'guide.md',
        '/repo/guide.md',
        'Alpha strict phrase.\n',
        expect.any(Object),
        expect.anything()
      )
    })
    expect(win.agent.sendThreads).not.toHaveBeenCalled()
    saved.fire?.(null, 'tab-1')
    await pending

    expect(win.agent.sendThreads).toHaveBeenCalledWith('guide.md', ['t-strict'], [
      { threadId: 't-strict', orphaned: false, lines: { start: 1, end: 1 } }
    ])
    expect(useLayoutStore().agentPanelTab).toBe('chat')

    vi.mocked(win.agent.sendThreads).mockClear()
    vi.mocked(notice.notify).mockClear()
    if (editor.currentFile) editor.currentFile.isSaved = false
    win.electron.ipcRenderer.on = vi.fn((channel: string, listener: (event: unknown, tabId: string) => void) => {
      if (channel === 'mt::tab-save-failure') queueMicrotask(() => listener(null, 'tab-1'))
      return vi.fn()
    })
    await sendCommentThreads('all')
    expect(win.agent.sendThreads).not.toHaveBeenCalled()
    expect(notice.notify).not.toHaveBeenCalled()
  })

  it('notifies and does not send when agent mode is off', async() => {
    usePreferencesStore().agentModeEnabled = false
    await sendCommentThreads('all')
    expect(win.agent.sendThreads).not.toHaveBeenCalled()
    expect(notice.notify).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Agent mode is off.'
    }))
  })
})
