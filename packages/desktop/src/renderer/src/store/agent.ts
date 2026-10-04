import type {
  AgentSelection,
  ChatEvent,
  HarnessId,
  HarnessStatus,
  ModelOption,
  PermissionRequest,
  RepoState,
  SessionSnapshot,
  SessionSummary,
  ThreadPlacement
} from '@shared/types/agent'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { usePreferencesStore } from './preferences'
import { createUnloadBag } from './releaseOnUnload'

const NONE: RepoState = { kind: 'none' }

export interface AgentTurn {
  id: string | null
  state: 'idle' | 'running'
}

export interface LastTurnChanges {
  turnId: string
  paths: string[]
}

export type OutboundSend =
  | { kind: 'message'; text: string }
  | { kind: 'threads'; file: string; threadIds: string[]; anchors: ThreadPlacement[] }

const IDLE_TURN: AgentTurn = { id: null, state: 'idle' }

/**
 * One visible message per `messageId`. Chunks arrive as separate events and
 * append in the order they were produced; a later id stays after an earlier one.
 */
export const foldChatEvents = (existing: readonly ChatEvent[], incoming: readonly ChatEvent[]): ChatEvent[] => {
  const next = existing.slice()
  for (const event of incoming) {
    if (event.type === 'message_chunk' || event.type === 'thought_chunk') {
      const index = next.findIndex((item) =>
        item.type === event.type &&
        item.messageId === event.messageId &&
        (item.type !== 'message_chunk' || event.type !== 'message_chunk' || item.role === event.role)
      )
      const prior = index >= 0 ? next[index] : undefined
      if (
        prior &&
        (prior.type === 'message_chunk' || prior.type === 'thought_chunk') &&
        (event.type === 'message_chunk' || event.type === 'thought_chunk')
      ) {
        next[index] = { ...prior, text: prior.text + event.text }
        continue
      }
    }
    next.push(event)
  }
  return next
}

const projectTranscript = (events: readonly ChatEvent[]): {
  turn: AgentTurn
  pending: PermissionRequest[]
  changes: LastTurnChanges | null
} => {
  let turn: AgentTurn = IDLE_TURN
  let pending: PermissionRequest[] = []
  let changes: LastTurnChanges | null = null
  for (const event of events) {
    if (event.type === 'turn_started') {
      turn = { id: event.turnId, state: 'running' }
      pending = []
    } else if (event.type === 'turn_finished') {
      turn = { id: event.turnId, state: 'idle' }
      pending = []
      changes = { turnId: event.turnId, paths: [...event.changedPaths] }
    } else if (event.type === 'permission_request') {
      pending = [...pending, event.request]
    }
  }
  return { turn, pending, changes }
}

export const useAgentStore = defineStore('agent', () => {
  const repoState = ref<RepoState>(NONE)
  const harnessStatuses = ref<HarnessStatus[]>([])
  const events = ref<ChatEvent[]>([])
  /** Empty until `getSelection` answers. A missing model blocks sending. */
  const selection = ref<AgentSelection | null>(null)
  const selectionKnown = ref(false)
  const models = ref<Partial<Record<HarnessId, ModelOption[]>>>({})
  const sessions = ref<SessionSummary[]>([])
  const activeSession = ref<SessionSummary | null>(null)
  const turn = ref<AgentTurn>(IDLE_TURN)
  const pendingPermissions = ref<PermissionRequest[]>([])
  const lastTurnChanges = ref<LastTurnChanges | null>(null)
  const panelOpen = ref(false)
  /** The send a failed turn retries. Threads stay a `send-threads` call. */
  const lastOutbound = ref<OutboundSend | null>(null)
  const bag = createUnloadBag()

  let loadToken = 0
  let reloadWhenIdle = false
  let queued: ChatEvent[] = []
  let frame: number | null = null

  const selectionModel = computed(() => selection.value?.model ?? null)

  // The open session keeps the model it was created with. The header selection
  // applies only to the next chat (00 §7.2).
  const sessionStaysOnModel = computed(() => {
    const current = activeSession.value
    const picked = selection.value?.model
    if (!current || !picked || current.model === picked) return null
    return current.model
  })

  // D25: agent chrome mounts only while this is true. A disabled mode or a
  // folder that is not a git repo must leave the window DOM unchanged.
  const agentAvailable = computed(() => {
    return usePreferencesStore().agentModeEnabled && repoState.value.kind === 'repo'
  })

  const turnInProgress = computed(() => turn.value.state === 'running')

  const flushQueued = (): void => {
    if (queued.length === 0) return
    const batch = queued
    queued = []
    events.value = foldChatEvents(events.value, batch)
  }

  const cancelFrame = (): void => {
    if (frame == null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  const applyControl = (event: ChatEvent): void => {
    if (event.type === 'turn_started') {
      turn.value = { id: event.turnId, state: 'running' }
      pendingPermissions.value = []
      return
    }
    if (event.type === 'turn_finished') {
      turn.value = { id: event.turnId, state: 'idle' }
      pendingPermissions.value = []
      lastTurnChanges.value = { turnId: event.turnId, paths: [...event.changedPaths] }
      // A restored session replays through applySnapshot and must not pop the tab.
      if (event.changedPaths.length > 0) {
        bus.emit('agent:show-turn-diff', {
          turnId: event.turnId,
          paths: [...event.changedPaths]
        })
      }
      if (reloadWhenIdle && panelOpen.value) {
        reloadWhenIdle = false
        loadChat().catch(() => undefined)
      }
      return
    }
    if (event.type === 'permission_request') {
      pendingPermissions.value = [...pendingPermissions.value, event.request]
    }
  }

  const ingest = (event: ChatEvent): void => {
    applyControl(event)
    if (event.type === 'message_chunk' || event.type === 'thought_chunk') {
      queued.push(event)
      if (frame == null) {
        frame = requestAnimationFrame(() => {
          frame = null
          flushQueued()
        })
      }
      return
    }
    cancelFrame()
    flushQueued()
    events.value = [...events.value, event]
  }

  const applySnapshot = (snapshot: SessionSnapshot): void => {
    cancelFrame()
    queued = []
    const folded = foldChatEvents([], snapshot.events)
    const projected = projectTranscript(folded)
    activeSession.value = snapshot.summary
    events.value = folded
    turn.value = projected.turn
    pendingPermissions.value = projected.pending
    lastTurnChanges.value = projected.changes
  }

  /**
   * Selection, then the model list, then the last session. A newer show or a
   * harness change drops a load that has not finished.
   */
  async function loadChat(): Promise<void> {
    const token = ++loadToken
    const harness = usePreferencesStore().agentHarness
    const agent = window.agent
    if (!agent?.getSelection || !agent.listModels || !agent.openSession) return

    const next = await agent.getSelection()
    if (token !== loadToken) return
    selection.value = next?.model ? { model: next.model } : null
    selectionKnown.value = true

    const listed = await agent.listModels(harness, {})
    if (token !== loadToken) return
    models.value = { ...models.value, [harness]: listed.ok ? listed.models : [] }

    const snapshot = await agent.openSession(harness, 'last')
    if (token !== loadToken) return
    applySnapshot(snapshot)

    if (!agent.listSessions) return
    const rows = await agent.listSessions(harness)
    if (token !== loadToken) return
    sessions.value = rows
  }

  async function openTarget(target: string | 'last' | 'new'): Promise<void> {
    const agent = window.agent
    if (!agent?.openSession) return
    const harness = usePreferencesStore().agentHarness
    const snapshot = await agent.openSession(harness, target)
    applySnapshot(snapshot)
    if (!agent.listSessions) return
    sessions.value = await agent.listSessions(harness)
  }

  function attachPanel(): Promise<void> {
    panelOpen.value = true
    return loadChat()
  }

  function detachPanel(): void {
    panelOpen.value = false
    reloadWhenIdle = false
  }

  async function setModel(model: string): Promise<void> {
    await window.agent?.setSelection(model)
    selection.value = { model }
    selectionKnown.value = true
  }

  function newChat(): Promise<void> {
    if (turn.value.state === 'running') return Promise.resolve()
    return openTarget('new')
  }

  function selectSession(id: string): Promise<void> {
    if (!id || id === activeSession.value?.id || turn.value.state === 'running') return Promise.resolve()
    return openTarget(id)
  }

  async function refreshModels(): Promise<void> {
    const agent = window.agent
    if (!agent?.listModels) return
    const harness = usePreferencesStore().agentHarness
    const listed = await agent.listModels(harness, { refresh: true })
    models.value = { ...models.value, [harness]: listed.ok ? listed.models : [] }
  }

  function rememberThreads(file: string, threadIds: string[], anchors: ThreadPlacement[]): void {
    lastOutbound.value = { kind: 'threads', file, threadIds, anchors: anchors.map((anchor) => ({ ...anchor })) }
  }

  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || turn.value.state === 'running') return
    const agent = window.agent
    if (!agent?.sendMessage) return
    lastOutbound.value = { kind: 'message', text: trimmed }
    await agent.sendMessage(trimmed)
  }

  async function retryLast(): Promise<void> {
    const last = lastOutbound.value
    const agent = window.agent
    if (!last || !agent || turn.value.state === 'running') return
    if (last.kind === 'message') await agent.sendMessage(last.text)
    else await agent.sendThreads(last.file, last.threadIds, last.anchors)
  }

  function cancelTurn(): Promise<void> {
    return window.agent?.cancelTurn() ?? Promise.resolve()
  }

  async function answerPermission(requestId: string, optionId: string): Promise<void> {
    pendingPermissions.value = pendingPermissions.value.filter((item) => item.requestId !== requestId)
    await window.agent?.answerPermission(requestId, optionId)
  }

  function refreshSelection(): void {
    const agent = window.agent
    if (!agent?.getSelection) return
    agent.getSelection().then((next) => {
      selection.value = next?.model ? { model: next.model } : null
      selectionKnown.value = true
    }).catch(() => {
      selection.value = null
      selectionKnown.value = true
    })
  }

  function refreshRepoState(): void {
    const run = async(): Promise<void> => {
      if (!window.agent || !usePreferencesStore().agentModeEnabled) {
        repoState.value = NONE
        return
      }

      try {
        repoState.value = await window.agent.getRepoState()
      } catch {
        // Main rejects the probe while agent mode is off, and a failed probe
        // must not leave the previous repository in place.
        repoState.value = NONE
      }
    }

    run().catch(() => undefined)
  }

  // The preference can change from another window after this one has already
  // probed. The gate reads the flag directly; the probe has to follow so a
  // later enable still learns whether the folder is a repo.
  watch(
    () => usePreferencesStore().agentModeEnabled,
    () => {
      refreshRepoState()
    }
  )

  // Settings owns the harness. While a turn is running the open transcript
  // stays; the new harness's last session is loaded once that turn ends (D21).
  watch(
    () => usePreferencesStore().agentHarness,
    () => {
      if (!panelOpen.value) return
      if (turn.value.state === 'running') {
        reloadWhenIdle = true
        return
      }
      loadChat().catch(() => undefined)
    }
  )

  function listen(): void {
    bag.listen((add) => {
      if (window.agent) {
        add(window.agent.onEvent((event) => {
          ingest(event)
        }))
        add(window.agent.onHarnessStatusChanged((statuses) => {
          harnessStatuses.value = statuses
          refreshRepoState()
          refreshSelection()
        }))
      }

      if (window.electron?.ipcRenderer) {
        add(window.electron.ipcRenderer.on('mt::open-directory', () => {
          refreshRepoState()
        }))
      }
    })

    refreshRepoState()
    refreshSelection()
  }

  function stop(): void {
    cancelFrame()
    queued = []
    bag.stop()
  }

  return {
    repoState,
    harnessStatuses,
    selection,
    selectionModel,
    selectionKnown,
    models,
    sessions,
    activeSession,
    events,
    turn,
    pendingPermissions,
    lastTurnChanges,
    sessionStaysOnModel,
    agentAvailable,
    turnInProgress,
    attachPanel,
    detachPanel,
    setModel,
    newChat,
    selectSession,
    refreshModels,
    rememberThreads,
    sendMessage,
    retryLast,
    cancelTurn,
    answerPermission,
    lastOutbound,
    refreshRepoState,
    refreshSelection,
    listen,
    stop
  }
})
