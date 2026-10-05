import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { ChatEvent, ModelOption, SessionSnapshot } from '@shared/types/agent'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.electron = {
    ipcRenderer: { on: () => () => {}, send: () => {}, invoke: () => Promise.resolve() }
  }
  w.window.path = { sep: '/' }
})

import bus from '@/bus'
import { useAgentStore } from '@/store/agent'
import { usePreferencesStore } from '@/store/preferences'

const win = window as unknown as {
  agent?: {
    getSelection: Mock
    listModels: Mock
    listSessions: Mock
    openSession: Mock
    setSelection: Mock
    onEvent: Mock
    onHarnessStatusChanged: Mock
    getRepoState: Mock
  }
}

const models: ModelOption[] = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' }
]

const snapshot = (id: string, model: string, events: ChatEvent[] = []): SessionSnapshot => ({
  summary: {
    id,
    title: id,
    model,
    createdAt: '2026-10-04T08:00:00.000Z',
    updatedAt: '2026-10-04T08:00:00.000Z',
    acpSessionId: null
  },
  events,
  model,
  resumable: true
})

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, resolve: settle }
}

describe('agent chat store', () => {
  let frames: FrameRequestCallback[]
  let getSelection: Mock
  let listModels: Mock
  let listSessions: Mock
  let openSession: Mock
  let setSelection: Mock
  let onEvent: Mock

  const flushFrame = (): void => {
    const pending = frames.splice(0)
    const time = 0
    for (const callback of pending) callback(time)
  }

  const emit = (event: ChatEvent): void => {
    const listener = onEvent.mock.calls[0]?.[0] as ((event: ChatEvent) => void) | undefined
    listener?.(event)
  }

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    getSelection = vi.fn(() => Promise.resolve({ model: 'alpha' }))
    listModels = vi.fn(() => Promise.resolve({ ok: true, models }))
    listSessions = vi.fn(() => Promise.resolve([snapshot('s-old', 'alpha').summary]))
    openSession = vi.fn(() => Promise.resolve(snapshot('s-old', 'alpha')))
    setSelection = vi.fn(() => Promise.resolve())
    onEvent = vi.fn(() => () => undefined)
    win.agent = {
      getSelection,
      listModels,
      listSessions,
      openSession,
      setSelection,
      onEvent,
      onHarnessStatusChanged: vi.fn(() => () => undefined),
      getRepoState: vi.fn(() => Promise.resolve({ kind: 'none' }))
    }
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useAgentStore().stop()
    vi.unstubAllGlobals()
  })

  it('opens the last session of the active harness when the panel is shown', async() => {
    const selection = deferred<{ model: string } | null>()
    const listed = deferred<{ ok: true; models: ModelOption[] }>()
    getSelection.mockReturnValue(selection.promise)
    listModels.mockReturnValue(listed.promise)

    const agent = useAgentStore()
    const opening = agent.attachPanel()
    expect(getSelection).toHaveBeenCalledTimes(1)
    expect(listModels).not.toHaveBeenCalled()

    selection.resolve({ model: 'alpha' })
    await vi.waitFor(() => expect(listModels).toHaveBeenCalledWith('opencode', {}))
    expect(openSession).not.toHaveBeenCalled()

    listed.resolve({ ok: true, models })
    await opening

    expect(openSession).toHaveBeenCalledWith('opencode', 'last')
    expect(listSessions).toHaveBeenCalledWith('opencode')
    expect(agent.selection).toEqual({ model: 'alpha' })
    expect(agent.models.opencode).toEqual(models)
    expect(agent.activeSession?.id).toBe('s-old')
    expect(agent.sessions.map((item) => item.id)).toEqual(['s-old'])
    expect(agent.turn).toEqual({ id: null, state: 'idle' })
  })

  it('still lists sessions when the last chat cannot be opened', async() => {
    openSession.mockRejectedValue(new Error('Invalid model value: opencode/big-pickle'))
    const agent = useAgentStore()
    await agent.attachPanel()

    expect(listSessions).toHaveBeenCalledWith('opencode')
    expect(agent.activeSession).toBeNull()
    expect(agent.sessions.map((item) => item.id)).toEqual(['s-old'])
  })

  it('keeps an open session on its model and starts a new chat without dropping the old one', async() => {
    const agent = useAgentStore()
    await agent.attachPanel()
    openSession.mockClear()

    await agent.setModel('beta')
    expect(setSelection).toHaveBeenCalledWith('beta')
    expect(openSession).not.toHaveBeenCalled()
    expect(agent.selection).toEqual({ model: 'beta' })
    expect(agent.sessionStaysOnModel).toBe('alpha')

    listSessions.mockResolvedValue([
      snapshot('s-old', 'alpha').summary,
      snapshot('s-new', 'beta').summary
    ])
    openSession.mockResolvedValue(snapshot('s-new', 'beta'))
    await agent.newChat()

    expect(openSession).toHaveBeenCalledWith('opencode', 'new')
    expect(agent.activeSession?.id).toBe('s-new')
    expect(agent.sessions.map((item) => item.id)).toEqual(['s-old', 's-new'])
    expect(agent.sessionStaysOnModel).toBeNull()
  })

  it('opens the new harness last session after the current turn, not during it', async() => {
    const agent = useAgentStore()
    agent.listen()
    await agent.attachPanel()
    expect(openSession).toHaveBeenCalledTimes(1)

    emit({ type: 'turn_started', turnId: 'turn-1' })
    expect(agent.turn).toEqual({ id: 'turn-1', state: 'running' })

    usePreferencesStore().agentHarness = 'pi'
    await nextTick()
    expect(openSession).toHaveBeenCalledTimes(1)

    emit({
      type: 'turn_finished',
      turnId: 'turn-1',
      stopReason: 'end_turn',
      changedPaths: ['guide.md'],
      missingReplyThreadIds: []
    })
    await vi.waitFor(() => expect(openSession).toHaveBeenCalledWith('pi', 'last'))
  })

  it('opens the diff for a live turn with paths and leaves a restored transcript alone', async() => {
    const opened: unknown[] = []
    const onDiff = (payload: unknown): void => {
      opened.push(payload)
    }
    bus.on('agent:show-turn-diff', onDiff)
    try {
      openSession.mockResolvedValue(snapshot('s-old', 'alpha', [{
        type: 'turn_finished',
        turnId: 'turn-old',
        stopReason: 'end_turn',
        changedPaths: ['notes.md'],
        missingReplyThreadIds: []
      }]))
      const agent = useAgentStore()
      await agent.attachPanel()
      expect(agent.lastTurnChanges).toEqual({ turnId: 'turn-old', paths: ['notes.md'] })
      expect(opened).toEqual([])

      agent.listen()
      emit({
        type: 'turn_finished',
        turnId: 'turn-empty',
        stopReason: 'end_turn',
        changedPaths: [],
        missingReplyThreadIds: []
      })
      expect(opened).toEqual([])

      emit({
        type: 'turn_finished',
        turnId: 'turn-live',
        stopReason: 'end_turn',
        changedPaths: ['notes.md'],
        missingReplyThreadIds: []
      })
      expect(opened).toEqual([{ turnId: 'turn-live', paths: ['notes.md'] }])
    } finally {
      bus.off('agent:show-turn-diff', onDiff)
    }
  })

  it('joins stream chunks of one message on the next frame and keeps a later message after it', async() => {
    const agent = useAgentStore()
    agent.listen()

    emit({ type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'Hel' })
    emit({ type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'lo' })
    emit({ type: 'thought_chunk', messageId: 't1', text: 'hmm' })
    expect(agent.events).toEqual([])
    expect(frames).toHaveLength(1)

    flushFrame()
    expect(agent.events).toEqual([
      { type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'Hello' },
      { type: 'thought_chunk', messageId: 't1', text: 'hmm' }
    ])

    emit({ type: 'message_chunk', role: 'agent', messageId: 'm2', text: 'Next' })
    emit({ type: 'thought_chunk', messageId: 't1', text: '!' })
    flushFrame()
    expect(agent.events).toEqual([
      { type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'Hello' },
      { type: 'thought_chunk', messageId: 't1', text: 'hmm!' },
      { type: 'message_chunk', role: 'agent', messageId: 'm2', text: 'Next' }
    ])
  })

  it('joins a token stream that uses a new id for every chunk', async() => {
    const agent = useAgentStore()
    agent.listen()
    emit({ type: 'thought_chunk', messageId: 't1', text: 'Фор' })
    emit({ type: 'thought_chunk', messageId: 't2', text: 'мули' })
    emit({ type: 'message_chunk', role: 'agent', messageId: 'a1', text: 'сред' })
    emit({ type: 'message_chunk', role: 'agent', messageId: 'a2', text: ' разработки' })
    flushFrame()
    expect(agent.events).toEqual([
      { type: 'thought_chunk', messageId: 't1', text: 'Формули' },
      { type: 'message_chunk', role: 'agent', messageId: 'a1', text: 'сред разработки' }
    ])
  })

  it('folds a restored transcript and tracks the permission that is still open', async() => {
    const request = {
      requestId: 'perm-1',
      title: 'Write guide.md',
      options: [{ id: 'allow', label: 'Allow', kind: 'allow_once' as const }]
    }
    openSession.mockResolvedValue(snapshot('s-old', 'alpha', [
      { type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'Hel' },
      { type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'lo' },
      { type: 'turn_started', turnId: 'turn-9' },
      { type: 'permission_request', request },
      {
        type: 'turn_finished',
        turnId: 'turn-9',
        stopReason: 'end_turn',
        changedPaths: ['notes.md'],
        missingReplyThreadIds: ['t-1']
      }
    ]))

    const agent = useAgentStore()
    await agent.attachPanel()
    expect(agent.events).toEqual([
      { type: 'message_chunk', role: 'agent', messageId: 'm1', text: 'Hello' },
      { type: 'turn_started', turnId: 'turn-9' },
      { type: 'permission_request', request },
      {
        type: 'turn_finished',
        turnId: 'turn-9',
        stopReason: 'end_turn',
        changedPaths: ['notes.md'],
        missingReplyThreadIds: ['t-1']
      }
    ])
    expect(agent.turn).toEqual({ id: 'turn-9', state: 'idle' })
    expect(agent.pendingPermissions).toEqual([])
    expect(agent.lastTurnChanges).toEqual({ turnId: 'turn-9', paths: ['notes.md'] })

    agent.listen()
    const live = {
      requestId: 'perm-2',
      title: 'Run git',
      options: [{ id: 'no', label: 'Reject', kind: 'reject_once' as const }]
    }
    emit({ type: 'turn_started', turnId: 'turn-2' })
    emit({ type: 'permission_request', request: live })
    expect(agent.pendingPermissions).toEqual([live])
  })
})
