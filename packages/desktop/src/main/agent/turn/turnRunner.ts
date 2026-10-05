import path from 'path'
import { HARNESS_DESCRIPTORS } from '../harness/harnessRegistry'
import type { HarnessQuirks } from '../harness/harnessRegistry'
import { AcpConnection, type SessionConfigSnapshot } from '../harness/acpConnection'
import type { TurnEndNotice } from '../harness/acpConnection'
import { modelsFromSessionConfig } from '../harness/modelProbe'
import { resolveHarnessCommand } from '../harness/resolveHarnessCommand'
import { applyBlockReplies } from '../harness/replyBlockParser'
import { bridgeForWindow } from '../mcpBridge/bridgeServer'
import { marktextMcpServer } from '../mcpBridge/marktextMcpServer'
import { load } from '../comments/commentsStore'
import { setWindowTurn } from '../comments/windowTurn'
import { repoRegistry } from '../repo/repoRegistry'
import { SessionStore, SessionStoreError } from '../sessions/sessionStore'
import type { SessionLine } from '../sessions/sessionStore'
import { ChangeTracker, attachChangeTracker, detachChangeTracker } from './changeTracker'
import { historyReplay } from './historyReplay'
import { buildThreadsMessage } from './messageBuilder'
import type { ThreadPlacement } from './messageBuilder'
import { isHarnessId } from '@shared/types/agent'
import type {
  AgentSelection,
  ChatEvent,
  HarnessId,
  SessionSnapshot,
  SessionSummary
} from '@shared/types/agent'
import type { Message, Thread } from '@shared/types/comments'

export type TurnRunnerCode =
  | 'agent_mode_disabled'
  | 'no_repo'
  | 'harness_not_found'
  | 'no_model'
  | 'turn_in_progress'
  | 'no_threads'
  | 'session_not_found'

export class TurnRunnerError extends Error {
  readonly code: TurnRunnerCode

  constructor(code: TurnRunnerCode, message: string) {
    super(message)
    this.name = 'TurnRunnerError'
    this.code = code
  }
}

export interface TurnRunnerDeps {
  modeEnabled(): boolean
  /** Preference value, including harness paths and `agentModeEnabled`. */
  preference(key: string): unknown
  userDataPath: string
  appPath: string
  now(): string
  newId(): string
  onEvent(windowId: number, event: ChatEvent): void
}

interface ActiveTurn {
  id: string
  windowId: number
  root: string
  harness: HarnessId
  model: string
  file: string | null
  threadIds: string[]
  startedAt: string
  sessionId: string
  agentText: string
  quirks: HarnessQuirks
  tracker: ChangeTracker | null
  writes: Promise<void>
}

const harnessOf = (id: HarnessId): { quirks: HarnessQuirks, command: string, args: readonly string[] } => {
  const descriptor = HARNESS_DESCRIPTORS.find((item) => item.id === id)
  if (!descriptor) throw new TurnRunnerError('harness_not_found', 'unknown harness')
  return {
    quirks: descriptor.quirks,
    command: descriptor.defaultCommand,
    args: descriptor.defaultArgs
  }
}

const pathKey: Record<HarnessId, string> = {
  opencode: 'agentOpencodePath',
  pi: 'agentPiPath',
  cursor: 'agentCursorPath'
}

const chatLine = (event: ChatEvent): SessionLine | null => {
  switch (event.type) {
    case 'message_chunk':
      return event.role === 'agent'
        ? { type: 'agent_message', messageId: event.messageId, text: event.text }
        : { type: 'user_message', messageId: event.messageId, text: event.text }
    case 'thought_chunk':
      return { type: 'thought', messageId: event.messageId, text: event.text }
    case 'tool_call':
      return {
        type: 'tool_call',
        toolCallId: event.toolCallId,
        title: event.title,
        status: event.status,
        locations: event.locations
      }
    case 'tool_call_update':
      return {
        type: 'tool_call_update',
        toolCallId: event.toolCallId,
        title: event.title,
        status: event.status,
        locations: event.locations,
        diffPaths: event.diffPaths
      }
    case 'plan':
      return { type: 'plan', text: event.text }
    case 'permission_request':
      return { type: 'permission', request: event.request }
    case 'turn_started':
      return { type: 'turn_started', turnId: event.turnId }
    case 'error':
      return { type: 'error', message: event.message }
    case 'turn_finished':
      return null
    default:
      return null
  }
}

const repliedThreads = (threads: readonly Thread[], turnId: string): Set<string> => {
  const answered = new Set<string>()
  for (const thread of threads) {
    const hit = thread.messages.some((message) => isAgentTurn(message, turnId))
    if (hit) answered.add(thread.id)
  }
  return answered
}

const isAgentTurn = (message: Message, turnId: string): boolean =>
  message.author.kind === 'agent' && 'turnId' in message && message.turnId === turnId

/**
 * One ACP turn for a window: comments batch or a free-form message.
 * The renderer saves the markdown file before `sendThreads`.
 */
export class TurnRunner {
  private readonly store: SessionStore
  private connection: AcpConnection | null = null
  private acpSessionId: string | null = null
  private boundHarness: HarnessId | null = null
  private chatSessionId: string | null = null
  private sessionModel: string | null = null
  /** Prefixed to the next user prompt when the harness could not resume. */
  private pendingReplay: string | null = null
  private liveResumable = false
  private switching = false
  private active: ActiveTurn | null = null
  private ended: Promise<void> = Promise.resolve()
  private settling: Promise<void> | null = null
  private spawn: { command: string, args: string[] } | null = null

  constructor(private readonly deps: TurnRunnerDeps) {
    this.store = new SessionStore(path.join(deps.userDataPath, 'agent'))
  }

  hasActiveTurn(): boolean {
    return this.active != null
  }

  agentPid(): number | null {
    return this.connection?.pid ?? null
  }

  async getSelection(windowId: number): Promise<AgentSelection | null> {
    const state = repoRegistry.state(windowId)
    if (state.kind !== 'repo') return null
    return this.store.getSelection(state.root)
  }

  /** Header model only. The open ACP session keeps the model it was created with. */
  async setSelection(windowId: number, model: string): Promise<void> {
    if (model.length === 0) throw new TurnRunnerError('no_model', 'no model is selected')
    await this.store.setSelection(this.rootOf(windowId), model)
  }

  /** Harness the live process belongs to, or null before the first session. */
  boundHarnessId(): HarnessId | null {
    return this.boundHarness
  }

  /**
   * Settings changed the harness. A running turn keeps its process; the next
   * send picks up the preference. An idle process for the old harness stops.
   */
  async applyHarnessPreference(next: HarnessId): Promise<void> {
    if (this.active || this.switching) return
    if (this.boundHarness && this.boundHarness !== next) await this.disposeHarness()
  }

  listSessions(windowId: number, harness: HarnessId): Promise<SessionSummary[]> {
    return this.store.listSessions(this.rootOf(windowId), harness)
  }

  /**
   * Opens the chat for a harness. A different harness replaces the process
   * when no turn is running. `'new'` starts an ACP session; an existing chat
   * is resumed, or replayed on the next user message when resume is unavailable.
   */
  async openSession(windowId: number, harness: HarnessId, target: string): Promise<SessionSnapshot> {
    if (!this.deps.modeEnabled()) {
      throw new TurnRunnerError('agent_mode_disabled', 'agent mode is off')
    }
    if (this.active || this.switching) {
      throw new TurnRunnerError('turn_in_progress', 'a turn is already running')
    }
    const root = this.rootOf(windowId)
    this.switching = true
    try {
      await this.prepareSpawn(harness)
      const summary = await this.resolveOpened(root, harness, target)
      await this.bindAcp(windowId, root, harness, summary.id)
      const snapshot = await this.store.readSession(root, harness, summary.id)
      return { ...snapshot, resumable: this.liveResumable }
    } finally {
      this.switching = false
    }
  }

  /** `session/cancel`, then reject a permission that is still waiting. Does not revert files. */
  cancelTurn(): Promise<void> {
    const sessionId = this.acpSessionId
    const connection = this.connection
    if (!this.active || !sessionId || !connection) return Promise.resolve()
    return connection.cancel(sessionId)
  }

  async disposeHarness(): Promise<void> {
    const connection = this.connection
    this.connection = null
    this.acpSessionId = null
    this.boundHarness = null
    this.chatSessionId = null
    this.sessionModel = null
    this.pendingReplay = null
    this.liveResumable = false
    if (connection) await connection.dispose()
  }

  async sendMessage(windowId: number, text: string): Promise<{ turnId: string }> {
    const turn = this.claim(windowId)
    try {
      await this.prepare(turn)
      const sessionId = await this.chatSession(turn.root, turn.harness, turn.model, null)
      turn.sessionId = sessionId
      await this.prepareWorktree(turn)
      await this.ensureAgent(turn)
      await this.speak(turn, text)
      await this.ended
      return { turnId: turn.id }
    } catch (error) {
      this.release(turn)
      throw error
    }
  }

  async sendThreads(
    windowId: number,
    file: string,
    threadIds: readonly string[],
    anchors: readonly ThreadPlacement[]
  ): Promise<{ turnId: string }> {
    const turn = this.claim(windowId)
    try {
      await this.prepare(turn)
      const batch = await this.openThreads(turn.root, file, threadIds)
      turn.file = file
      turn.threadIds = batch.ids
      const sessionId = await this.chatSession(turn.root, turn.harness, turn.model, file)
      turn.sessionId = sessionId
      await this.prepareWorktree(turn)
      await this.ensureAgent(turn)
      setWindowTurn(turn.windowId, {
        turnId: turn.id,
        file,
        threadIds: batch.ids,
        harness: turn.harness,
        model: turn.model
      })
      const text = buildThreadsMessage({
        file,
        threads: batch.threads,
        anchors: anchors.filter((anchor) => batch.ids.includes(anchor.threadId)),
        repliesVia: turn.quirks.repliesVia
      })
      await this.speak(turn, text)
      await this.ended
      return { turnId: turn.id }
    } catch (error) {
      this.release(turn)
      throw error
    }
  }

  /** Marks the window busy before the first await, so a second send is rejected. */
  private claim(windowId: number): ActiveTurn {
    if (!this.deps.modeEnabled()) {
      throw new TurnRunnerError('agent_mode_disabled', 'agent mode is off')
    }
    const state = repoRegistry.state(windowId)
    if (state.kind !== 'repo') {
      throw new TurnRunnerError('no_repo', 'the window has no repository')
    }
    if (this.active || this.switching) {
      throw new TurnRunnerError('turn_in_progress', 'a turn is already running')
    }
    const turn: ActiveTurn = {
      id: this.deps.newId(),
      windowId,
      root: state.root,
      harness: 'pi',
      model: '',
      file: null,
      threadIds: [],
      startedAt: this.deps.now(),
      sessionId: '',
      agentText: '',
      quirks: harnessOf('pi').quirks,
      tracker: null,
      writes: Promise.resolve()
    }
    this.active = turn
    this.settling = null
    return turn
  }

  private release(turn: ActiveTurn): void {
    if (this.settling || this.active !== turn) return
    this.active = null
    setWindowTurn(turn.windowId, null)
    detachChangeTracker(turn.windowId)
  }

  private rootOf(windowId: number): string {
    const state = repoRegistry.state(windowId)
    if (state.kind !== 'repo') throw new TurnRunnerError('no_repo', 'the window has no repository')
    return state.root
  }

  /** Preference, not the chat header. An unknown value stays on OpenCode. */
  private activeHarness(): HarnessId {
    const value = this.deps.preference('agentHarness')
    return isHarnessId(value) ? value : 'opencode'
  }

  private async prepare(turn: ActiveTurn): Promise<void> {
    const preferred = this.activeHarness()
    if (this.boundHarness && this.boundHarness !== preferred) await this.disposeHarness()
    if (this.boundHarness && this.sessionModel) {
      turn.harness = this.boundHarness
      turn.model = this.sessionModel
    } else {
      const selection = await this.requireSelection(turn.root)
      turn.harness = preferred
      turn.model = selection.model
    }
    turn.quirks = harnessOf(turn.harness).quirks
    await this.prepareSpawn(turn.harness)
  }

  private async prepareSpawn(harness: HarnessId): Promise<void> {
    const spec = harnessOf(harness)
    const configured = this.deps.preference(pathKey[harness])
    const resolved = resolveHarnessCommand(
      spec.command,
      spec.args,
      typeof configured === 'string' ? configured : ''
    )
    if (!resolved.ok) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    this.spawn = { command: resolved.command, args: resolved.args }
  }

  private async resolveOpened(root: string, harness: HarnessId, target: string): Promise<SessionSummary> {
    if (target === 'new') return this.createOpened(root, harness)
    const sessionId = target === 'last' ? await this.store.getLastSession(root, harness) : target
    if (!sessionId) return this.createOpened(root, harness)
    try {
      const snapshot = await this.store.readSession(root, harness, sessionId)
      if (target !== 'last') await this.store.setLastSession(root, harness, snapshot.summary.id)
      return snapshot.summary
    } catch (error) {
      if (error instanceof SessionStoreError && error.code === 'not_found') {
        throw new TurnRunnerError('session_not_found', 'the session was not found')
      }
      throw error
    }
  }

  private async createOpened(root: string, harness: HarnessId): Promise<SessionSummary> {
    const selection = await this.requireSelection(root)
    const created = await this.store.createSession(root, harness, selection.model)
    await this.store.setLastSession(root, harness, created.id)
    return created
  }

  private async requireSelection(root: string): Promise<AgentSelection> {
    const selection = await this.store.getSelection(root)
    if (!selection) throw new TurnRunnerError('no_model', 'no model is selected')
    return selection
  }

  private async openThreads(
    root: string,
    file: string,
    threadIds: readonly string[]
  ): Promise<{ ids: string[], threads: Thread[] }> {
    const loaded = await load(root, file)
    if (loaded.kind !== 'ok') {
      throw new TurnRunnerError('no_threads', 'the comments file could not be read')
    }
    const open = new Map(loaded.file.threads.filter((thread) => thread.status === 'open').map((thread) => [thread.id, thread]))
    const threads: Thread[] = []
    for (const id of threadIds) {
      const thread = open.get(id)
      if (thread) threads.push(thread)
    }
    if (threads.length === 0) {
      throw new TurnRunnerError('no_threads', 'no open threads of this file to send')
    }
    return { ids: threads.map((thread) => thread.id), threads }
  }

  private async chatSession(
    root: string,
    harness: HarnessId,
    model: string,
    file: string | null
  ): Promise<string> {
    if (this.chatSessionId && this.boundHarness === harness) return this.chatSessionId
    const existing = await this.store.getLastSession(root, harness)
    if (existing) return existing
    const created = await this.store.createSession(root, harness, model, file ? { file } : undefined)
    await this.store.setLastSession(root, harness, created.id)
    return created.id
  }

  private async prepareWorktree(turn: ActiveTurn): Promise<void> {
    const tracker = await ChangeTracker.open(turn.root)
    turn.tracker = tracker
    attachChangeTracker(turn.windowId, tracker)
  }

  private async ensureAgent(turn: ActiveTurn): Promise<void> {
    // A crash leaves the connection object in place with a dead pid. Prompting
    // that id fails; the same chat has to be opened on a new process.
    if (
      this.connection?.pid != null &&
      this.acpSessionId &&
      this.boundHarness === turn.harness &&
      this.chatSessionId === turn.sessionId
    ) return
    const opened = await this.store.readSession(turn.root, turn.harness, turn.sessionId)
    turn.model = opened.model
    await this.bindAcp(turn.windowId, turn.root, turn.harness, turn.sessionId)
  }

  private async bindAcp(windowId: number, root: string, harness: HarnessId, sessionId: string): Promise<void> {
    if (this.connection?.pid == null || this.boundHarness !== harness) {
      await this.disposeHarness()
      await this.startProcess(root, harness)
    }
    const connection = this.connection
    if (!connection) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    const snapshot = await this.store.readSession(root, harness, sessionId)
    const bridge = await bridgeForWindow(this.deps.userDataPath, windowId)
    const servers = [marktextMcpServer(this.deps.appPath, bridge.address, bridge.token)]
    if (snapshot.summary.acpSessionId && connection.supportsResume()) {
      try {
        const resumed = await connection.resumeSession(snapshot.summary.acpSessionId, servers)
        if (resumed.kind === 'resumed') {
          this.rememberLive(harness, sessionId, snapshot.model, resumed.sessionId, true)
          this.pendingReplay = null
          return
        }
      } catch {
        // The stored ACP id is gone. A new session carries the transcript instead.
      }
    }
    const created = await connection.newSession({ cwd: root, mcpServers: servers })
    const model = await this.modelOffered(root, snapshot.model, created.configOptions)
    if (model) await connection.setModel(created.sessionId, model)
    if (model && model !== snapshot.model) {
      await this.store.setSessionModel(root, harness, sessionId, model)
    }
    const resumable = connection.supportsResume()
    await this.store.setAcpSessionId(root, harness, sessionId, resumable ? created.sessionId : null)
    this.rememberLive(harness, sessionId, model ?? snapshot.model, created.sessionId, resumable)
    this.pendingReplay = resumable ? null : historyReplay(snapshot.events)
  }

  /**
   * The header model is one value for every harness. A chat saved under another
   * harness can carry an id this process does not offer; sending it makes
   * `session/set_config_option` fail and the session list never loads.
   * Returns null when neither the stored id nor the header selection is offered,
   * so the harness keeps its own default.
   */
  private async modelOffered(
    root: string,
    requested: string,
    configOptions: readonly SessionConfigSnapshot[]
  ): Promise<string | null> {
    const offered = modelsFromSessionConfig(configOptions)
    if (!offered) return requested
    if (offered.some((model) => model.id === requested)) return requested
    const picked = (await this.store.getSelection(root))?.model
    if (picked && offered.some((model) => model.id === picked)) return picked
    return null
  }

  private rememberLive(
    harness: HarnessId,
    sessionId: string,
    model: string,
    acpSessionId: string,
    resumable: boolean
  ): void {
    this.boundHarness = harness
    this.chatSessionId = sessionId
    this.sessionModel = model
    this.acpSessionId = acpSessionId
    this.liveResumable = resumable
  }

  private async startProcess(root: string, harness: HarnessId): Promise<void> {
    const spawn = this.spawn
    if (!spawn) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    this.connection = await AcpConnection.start({
      command: spawn.command,
      args: spawn.args,
      cwd: root,
      harness,
      quirks: harnessOf(harness).quirks,
      onEvent: (event) => this.onAgentEvent(event),
      onTurnEnd: (notice) => {
        this.ended = this.finalize(notice)
      },
      log: () => undefined
    })
  }

  private async speak(turn: ActiveTurn, text: string): Promise<void> {
    const connection = this.connection
    const sessionId = this.acpSessionId
    if (!connection || !sessionId) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    const replay = this.pendingReplay
    const delivered = replay ? `${replay}\n\n${text}` : text
    this.pendingReplay = null
    this.publish(turn, { type: 'turn_started', turnId: turn.id })
    this.publish(turn, { type: 'message_chunk', role: 'user', messageId: turn.id, text })
    await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, { type: 'turn_started', turnId: turn.id })
    await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, {
      type: 'user_message',
      messageId: turn.id,
      text
    })
    this.ended = Promise.resolve()
    try {
      await connection.prompt(sessionId, delivered, turn.id)
    } catch (error) {
      this.pendingReplay = replay
      throw error
    }
  }

  private onAgentEvent(event: ChatEvent): void {
    const turn = this.active
    if (!turn || event.type === 'turn_finished' || event.type === 'turn_started') return
    if (event.type === 'message_chunk' && event.role === 'user') return
    if (event.type === 'tool_call') turn.tracker?.noteAcpPaths(event.locations)
    if (event.type === 'tool_call_update') {
      turn.tracker?.noteAcpPaths(event.locations)
      turn.tracker?.noteAcpPaths(event.diffPaths)
    }
    if (event.type === 'message_chunk' && event.role === 'agent') turn.agentText += event.text
    this.publish(turn, event)
    const line = chatLine(event)
    if (!line) return
    turn.writes = turn.writes.then(
      () => this.store.appendEvent(turn.root, turn.harness, turn.sessionId, line),
      () => this.store.appendEvent(turn.root, turn.harness, turn.sessionId, line)
    )
  }

  private publish(turn: ActiveTurn, event: ChatEvent): void {
    this.deps.onEvent(turn.windowId, event)
  }

  private finalize(notice: TurnEndNotice): Promise<void> {
    if (this.settling) return this.settling
    const turn = this.active
    if (!turn || turn.id !== notice.turnId) return Promise.resolve()
    this.settling = this.finish(turn, notice).finally(() => {
      if (this.active === turn) this.active = null
      setWindowTurn(turn.windowId, null)
      detachChangeTracker(turn.windowId)
    })
    return this.settling
  }

  private async finish(turn: ActiveTurn, notice: TurnEndNotice): Promise<void> {
    await turn.writes
    let blockError: ChatEvent | null = null
    if (turn.quirks.repliesVia === 'block' && turn.threadIds.length > 0) {
      try {
        blockError = await applyBlockReplies({
          repliesVia: 'block',
          windowId: turn.windowId,
          root: turn.root,
          turnId: turn.id,
          agentText: turn.agentText
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        blockError = { type: 'error', message }
      }
    }
    const missingReplyThreadIds = await this.missingReplies(turn)
    const changedPaths = turn.tracker ? await turn.tracker.finish() : []
    if (notice.stopReason === 'error' && notice.message) {
      this.publish(turn, { type: 'error', message: notice.message })
      await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, {
        type: 'error',
        message: notice.message
      })
    }
    if (blockError?.type === 'error') {
      this.publish(turn, blockError)
      await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, {
        type: 'error',
        message: blockError.message
      })
    }
    const finishedAt = this.deps.now()
    const event: ChatEvent = {
      type: 'turn_finished',
      turnId: turn.id,
      stopReason: notice.stopReason,
      changedPaths,
      missingReplyThreadIds
    }
    this.publish(turn, event)
    await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, {
      type: 'turn_finished',
      turnId: turn.id,
      stopReason: notice.stopReason,
      changedPaths,
      missingReplyThreadIds,
      file: turn.file,
      threadIds: turn.threadIds,
      startedAt: turn.startedAt,
      finishedAt
    })
    if (notice.stopReason === 'end_turn') {
      await this.store.rememberUsed(turn.model)
    }
  }

  private async missingReplies(turn: ActiveTurn): Promise<string[]> {
    if (!turn.file || turn.threadIds.length === 0) return []
    const loaded = await load(turn.root, turn.file)
    if (loaded.kind !== 'ok') return [...turn.threadIds]
    const answered = repliedThreads(loaded.file.threads, turn.id)
    return turn.threadIds.filter((id) => !answered.has(id))
  }
}
