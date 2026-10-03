import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ChatEvent, HarnessStatus, RepoState } from '@shared/types/agent'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.electron = {
    ipcRenderer: {
      on: vi.fn(() => vi.fn()),
      send: vi.fn(),
      invoke: vi.fn(() => Promise.resolve())
    }
  }
  w.window.path = { sep: '/' }
})

import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useTerminalStore } from '@/store/terminal'
import { usePreferencesStore } from '@/store/preferences'

const win = window as unknown as {
  electron: { ipcRenderer: { on: Mock; send: Mock; invoke: Mock } }
  agent?: {
    getRepoState: Mock
    onEvent: Mock
    onHarnessStatusChanged: Mock
  }
  comments?: { onChanged: Mock }
  term?: { onData: Mock; onExit: Mock }
}

const repo: RepoState = { kind: 'repo', root: '/repo', userName: 'Ada' }
const status: HarnessStatus = {
  id: 'opencode',
  found: true,
  resolvedPath: '/usr/bin/opencode',
  version: '1',
  reason: null,
  message: null
}

describe('agent mode gate', () => {
  const releases: Mock[] = []
  let getRepoState: Mock
  let onEvent: Mock
  let onHarnessStatusChanged: Mock
  let onChanged: Mock
  let onExit: Mock
  let ipcOn: Mock

  const track = (): Mock => {
    const release = vi.fn()
    releases.push(release)
    return release
  }

  beforeEach(() => {
    releases.length = 0
    getRepoState = vi.fn(() => Promise.resolve(repo))
    onEvent = vi.fn(() => track())
    onHarnessStatusChanged = vi.fn(() => track())
    onChanged = vi.fn(() => track())
    onExit = vi.fn(() => track())
    ipcOn = vi.fn(() => track())
    win.electron = {
      ipcRenderer: {
        on: ipcOn,
        send: vi.fn(),
        invoke: vi.fn(() => Promise.resolve())
      }
    }
    win.agent = { getRepoState, onEvent, onHarnessStatusChanged }
    win.comments = { onChanged }
    win.term = {
      onData: vi.fn(() => track()),
      onExit
    }
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useAgentStore().stop()
    useCommentsStore().stop()
    useTerminalStore().stop()
    delete win.agent
    delete win.comments
    delete win.term
  })

  it('is available only when agent mode is on and the folder is a git repo', async() => {
    const agent = useAgentStore()
    const preferences = usePreferencesStore()

    agent.listen()
    await vi.waitFor(() => {
      expect(agent.agentAvailable).toBe(true)
    })

    preferences.$patch({ agentModeEnabled: false })
    await vi.waitFor(() => {
      expect(agent.repoState.kind).toBe('none')
    })
    expect(agent.agentAvailable).toBe(false)

    preferences.$patch({ agentModeEnabled: true })
    getRepoState.mockResolvedValueOnce({ kind: 'none' })
    await vi.waitFor(() => {
      expect(agent.agentAvailable).toBe(false)
    })
  })

  it('refreshes the repo on open-directory and on harness-status-changed', async() => {
    const agent = useAgentStore()
    agent.listen()
    await vi.waitFor(() => expect(getRepoState).toHaveBeenCalledTimes(1))

    const directory = ipcOn.mock.calls.find((call) => call[0] === 'mt::open-directory')
    expect(directory).toBeTruthy()
    const onDirectory = directory?.[1] as (() => void) | undefined
    onDirectory?.()
    await vi.waitFor(() => expect(getRepoState).toHaveBeenCalledTimes(2))

    const onStatus = onHarnessStatusChanged.mock.calls[0]?.[0] as ((statuses: HarnessStatus[]) => void) | undefined
    onStatus?.([status])
    expect(agent.harnessStatuses).toEqual([status])
    await vi.waitFor(() => expect(getRepoState).toHaveBeenCalledTimes(3))
  })

  it('drops agent, comment, and terminal subscriptions on stop', () => {
    const agent = useAgentStore()
    const comments = useCommentsStore()
    const terminal = useTerminalStore()

    agent.listen()
    comments.listen()
    terminal.listen()

    const emitEvent = onEvent.mock.calls[0]?.[0] as ((event: ChatEvent) => void) | undefined
    const emitChanged = onChanged.mock.calls[0]?.[0] as ((payload: { file: string }) => void) | undefined
    const emitExit = onExit.mock.calls[0]?.[0] as ((termId: string, code: number | null) => void) | undefined

    emitEvent?.({ type: 'error', message: 'x' })
    emitChanged?.({ file: 'docs/guide.md' })
    emitExit?.('t1', 0)
    expect(agent.events).toHaveLength(1)
    expect(comments.availability).toEqual({ kind: 'unavailable', reason: 'untitled' })
    expect(comments.threads).toEqual([])
    expect(terminal.exits).toEqual([{ termId: 't1', code: 0 }])

    window.dispatchEvent(new Event('pagehide'))

    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true)
  })
})
