import path from 'path'
import { HARNESS_DESCRIPTORS } from '../harness/harnessRegistry'
import type { HarnessQuirks } from '../harness/harnessRegistry'
import { AcpConnection } from '../harness/acpConnection'
import type { TurnEndNotice } from '../harness/acpConnection'
import { resolveHarnessCommand } from '../harness/resolveHarnessCommand'
import { applyBlockReplies } from '../harness/replyBlockParser'
import { bridgeForWindow } from '../mcpBridge/bridgeServer'
import { marktextMcpServer } from '../mcpBridge/marktextMcpServer'
import { load } from '../comments/commentsStore'
import { setWindowTurn } from '../comments/windowTurn'
import { repoRegistry } from '../repo/repoRegistry'
import { SessionStore } from '../sessions/sessionStore'
import type { SessionLine } from '../sessions/sessionStore'
import { ChangeTracker, attachChangeTracker, detachChangeTracker } from './changeTracker'
import { buildThreadsMessage } from './messageBuilder'
import type { ThreadPlacement } from './messageBuilder'
import type {
  AgentSelection,
  ChatEvent,
  HarnessId
} from '@shared/types/agent'
import type { Message, Thread } from '@shared/types/comments'

export type TurnRunnerCode =
  | 'agent_mode_disabled'
  | 'no_repo'
  | 'harness_not_found'
  | 'no_model'
  | 'turn_in_progress'
  | 'no_threads'

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
    if (this.active) throw new TurnRunnerError('turn_in_progress', 'a turn is already running')
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

  private async prepare(turn: ActiveTurn): Promise<void> {
    const selection = await this.requireSelection(turn.root)
    turn.harness = selection.harness
    turn.model = selection.model
    const harness = harnessOf(selection.harness)
    turn.quirks = harness.quirks
    const configured = this.deps.preference(pathKey[selection.harness])
    const resolved = resolveHarnessCommand(
      harness.command,
      harness.args,
      typeof configured === 'string' ? configured : ''
    )
    if (!resolved.ok) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    this.spawn = { command: resolved.command, args: resolved.args }
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
    if (this.connection && this.acpSessionId && this.boundHarness === turn.harness) return
    await this.disposeHarness()
    const spawn = this.spawn
    if (!spawn) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    const bridge = await bridgeForWindow(this.deps.userDataPath, turn.windowId)
    this.connection = await AcpConnection.start({
      command: spawn.command,
      args: spawn.args,
      cwd: turn.root,
      harness: turn.harness,
      quirks: turn.quirks,
      onEvent: (event) => this.onAgentEvent(event),
      onTurnEnd: (notice) => {
        this.ended = this.finalize(notice)
      },
      log: () => undefined
    })
    const created = await this.connection.newSession({
      cwd: turn.root,
      mcpServers: [marktextMcpServer(this.deps.appPath, bridge.address, bridge.token)]
    })
    await this.connection.setModel(created.sessionId, turn.model)
    this.acpSessionId = created.sessionId
    this.boundHarness = turn.harness
  }

  private async speak(turn: ActiveTurn, text: string): Promise<void> {
    const connection = this.connection
    const sessionId = this.acpSessionId
    if (!connection || !sessionId) throw new TurnRunnerError('harness_not_found', 'the harness was not found')
    this.publish(turn, { type: 'turn_started', turnId: turn.id })
    this.publish(turn, { type: 'message_chunk', role: 'user', messageId: turn.id, text })
    await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, { type: 'turn_started', turnId: turn.id })
    await this.store.appendEvent(turn.root, turn.harness, turn.sessionId, {
      type: 'user_message',
      messageId: turn.id,
      text
    })
    this.ended = Promise.resolve()
    await connection.prompt(sessionId, text, turn.id)
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
      await this.store.setSelection(turn.root, { harness: turn.harness, model: turn.model }, { used: true })
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
