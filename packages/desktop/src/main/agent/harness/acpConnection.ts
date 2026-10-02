import { spawn, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import path from 'path'
import { Readable, Writable } from 'stream'
import {
  PROTOCOL_VERSION,
  RequestError,
  client,
  methods,
  ndJsonStream
} from '@agentclientprotocol/sdk'
import type {
  ClientConnection,
  InitializeResponse,
  McpServer,
  NewSessionResponse,
  RequestPermissionRequest,
  SessionNotification,
  SessionUpdate
} from '@agentclientprotocol/sdk'
import log from 'electron-log'
import {
  ACP_INIT_TIMEOUT_MS,
  type ChatEvent,
  type HarnessId,
  type PermissionOptionKind,
  type PermissionRequest,
  type ToolCallStatus,
  type TurnStopReason
} from '@shared/types/agent'
import type { HarnessQuirks } from './harnessRegistry'
import { answerPermission, waitForPermissionAnswer } from './permissionGate'

const STDERR_LIMIT = 8 * 1024
const KILL_GRACE_MS = 3_000
const AUTH_REQUIRED_CODE = -32000

const PERMISSION_KINDS: readonly PermissionOptionKind[] = [
  'allow_once',
  'allow_always',
  'reject_once',
  'reject_always'
]

export interface SessionConfigSnapshot {
  id: string
  category?: string | null
  type?: string
  options?: unknown
}

export interface AcpMcpServer {
  name: string
  command: string
  args: string[]
  env?: { name: string, value: string }[]
}

export type ResumeResult =
  | { kind: 'resumed', sessionId: string }
  | { kind: 'unsupported' }

export class AcpAuthRequiredError extends Error {
  readonly reason = 'auth_required' as const

  constructor(message: string) {
    super(message)
    this.name = 'AcpAuthRequiredError'
  }
}

export interface TurnEndNotice {
  turnId: string
  stopReason: TurnStopReason
  message?: string
}

export interface AcpConnectionOptions {
  command: string
  args: readonly string[]
  cwd: string
  harness: HarnessId
  quirks: HarnessQuirks
  onEvent: (event: ChatEvent) => void
  /**
   * When set, the caller owns `turn_started`, the prompt text, and
   * `turn_finished`. The connection only reports that the ACP turn ended.
   */
  onTurnEnd?: (notice: TurnEndNotice) => void
  log?: (line: string) => void
  /** How long SIGTERM is given before SIGKILL. Windows uses `taskkill /T /F` at once. */
  killGraceMs?: number
}

const clientVersion = (): string =>
  typeof MARKTEXT_VERSION === 'string' ? MARKTEXT_VERSION : '0.21.0-dev'

const authHint = (harness: HarnessId): string => {
  if (harness === 'cursor') return 'agent login'
  if (harness === 'opencode') return 'opencode auth login'
  return 'authentication required'
}

const isAuthRequired = (error: unknown): boolean => {
  if (!(error instanceof RequestError)) return false
  if (error.code === AUTH_REQUIRED_CODE) return true
  if (error.message.includes('auth_required')) return true
  try {
    return JSON.stringify(error.data ?? null).includes('auth_required')
  } catch {
    return false
  }
}

const mapStop = (reason: string): TurnStopReason => {
  if (reason === 'end_turn' || reason === 'cancelled' || reason === 'max_tokens' || reason === 'refusal') {
    return reason
  }
  return 'error'
}

const repoRelative = (root: string, filePath: string): string =>
  path.relative(root, filePath).split(path.sep).join('/')

const textOf = (content: { type: string, text?: string }): string | null =>
  content.type === 'text' && typeof content.text === 'string' ? content.text : null

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

interface OpenTurn {
  id: string
  changed: string[]
}

/**
 * One ACP process for a window. Client capabilities stay empty: the editor
 * does not offer `fs` or `terminal`. A listed `authMethods` entry is not a
 * failure by itself — OpenCode advertises `opencode-login` and still accepts
 * `session/new`. `authenticate` runs only after an `auth_required` error.
 */
export class AcpConnection {
  readonly cwd: string
  agentVersion: string | null = null

  /** OS pid of the harness process, or null after it has exited. */
  get pid(): number | null {
    const child = this.child
    if (!child || child.exitCode != null || child.signalCode != null) return null
    return child.pid ?? null
  }

  private readonly options: AcpConnectionOptions
  private readonly writeLog: (line: string) => void
  private child: ChildProcess | null = null
  private link: ClientConnection | null = null
  private ready = false
  private disposed = false
  private authenticated = false
  private capabilities: InitializeResponse['agentCapabilities']
  private authMethods: { id: string }[] = []
  private modelConfigId = 'model'
  private mcpServers: McpServer[] = []
  private turn: OpenTurn | null = null
  private pendingPermission: string | null = null
  private stderrLogged = 0
  private killTimer: ReturnType<typeof setTimeout> | null = null

  private constructor(options: AcpConnectionOptions) {
    this.options = options
    this.cwd = options.cwd
    this.writeLog = options.log ?? ((line) => {
      log.info(line)
    })
  }

  static async start(options: AcpConnectionOptions): Promise<AcpConnection> {
    const connection = new AcpConnection(options)
    await connection.openProcess()
    return connection
  }

  async newSession(input: { cwd: string, mcpServers: AcpMcpServer[] }): Promise<{
    sessionId: string
    configOptions: SessionConfigSnapshot[]
  }> {
    await this.ensureOpen()
    this.useMcpServers(input.mcpServers)
    const created = await this.requestNew({
      cwd: input.cwd,
      mcpServers: this.mcpServers
    })
    this.rememberModel(created.configOptions)
    return {
      sessionId: created.sessionId,
      configOptions: (created.configOptions ?? []).map((option) => ({
        id: option.id,
        category: option.category ?? null,
        type: option.type,
        options: option.type === 'select' ? option.options : undefined
      }))
    }
  }

  /**
   * True when `initialize` advertised `session/resume` or `session/load`
   * and this harness does not opt out.
   */
  supportsResume(): boolean {
    if (this.options.quirks.resume === 'none') return false
    if (this.capabilities?.sessionCapabilities?.resume != null) return true
    return this.capabilities?.loadSession === true
  }

  /**
   * `session/resume` when the agent advertises it, otherwise `session/load`
   * when `loadSession` is set. `quirks.resume: 'none'` skips both.
   * `mcpServers` replaces the list sent with the resume request.
   */
  async resumeSession(acpSessionId: string, mcpServers?: AcpMcpServer[]): Promise<ResumeResult> {
    await this.ensureOpen()
    if (mcpServers) this.useMcpServers(mcpServers)
    if (!this.supportsResume()) return { kind: 'unsupported' }
    const agent = this.requireAgent()
    const sessionCapabilities = this.capabilities?.sessionCapabilities
    if (sessionCapabilities?.resume != null) {
      const resumed = await agent.request(methods.agent.session.resume, {
        sessionId: acpSessionId,
        cwd: this.cwd,
        mcpServers: this.mcpServers
      })
      this.rememberModel(resumed.configOptions)
      return { kind: 'resumed', sessionId: acpSessionId }
    }
    if (this.capabilities?.loadSession) {
      const loaded = await agent.request(methods.agent.session.load, {
        sessionId: acpSessionId,
        cwd: this.cwd,
        mcpServers: this.mcpServers
      })
      this.rememberModel(loaded.configOptions)
      return { kind: 'resumed', sessionId: acpSessionId }
    }
    return { kind: 'unsupported' }
  }

  async setModel(sessionId: string, modelId: string): Promise<void> {
    await this.ensureOpen()
    await this.requireAgent().request(methods.agent.session.setConfigOption, {
      sessionId,
      configId: this.modelConfigId,
      value: modelId
    })
  }

  async prompt(sessionId: string, text: string, turnId?: string): Promise<{ stopReason: TurnStopReason }> {
    await this.ensureOpen()
    if (this.turn) throw new Error('a turn is already running')
    const id = turnId ?? randomUUID()
    this.turn = { id, changed: [] }
    if (!this.options.onTurnEnd) {
      this.options.onEvent({ type: 'turn_started', turnId: id })
      this.options.onEvent({
        type: 'message_chunk',
        role: 'user',
        messageId: id,
        text
      })
    }
    try {
      const result = await this.requireAgent().request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: 'text', text }]
      })
      const stop = mapStop(result.stopReason)
      if (stop === 'error') this.finishTurn('error', `agent stopped: ${result.stopReason}`)
      else this.finishTurn(stop)
      return { stopReason: stop }
    } catch (error) {
      if (this.turn) {
        const message = error instanceof Error ? error.message : String(error)
        this.finishTurn('error', message)
      }
      return { stopReason: 'error' }
    }
  }

  async cancel(sessionId: string): Promise<void> {
    if (this.pendingPermission) {
      answerPermission(this.pendingPermission, 'cancelled')
      this.pendingPermission = null
    }
    if (!this.ready) return
    await this.requireAgent().notify(methods.agent.session.cancel, { sessionId })
  }

  async close(sessionId: string): Promise<void> {
    await this.ensureOpen()
    if (this.capabilities?.sessionCapabilities?.close == null) return
    await this.requireAgent().request(methods.agent.session.close, { sessionId })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.ready = false
    if (this.pendingPermission) {
      answerPermission(this.pendingPermission, 'cancelled')
      this.pendingPermission = null
    }
    if (this.turn) this.finishTurn('error', 'agent stopped')
    this.link?.close()
    this.link = null
    await this.killChild()
  }

  private async ensureOpen(): Promise<void> {
    if (this.disposed) throw new Error('agent connection is closed')
    if (this.alive()) return
    await this.openProcess()
  }

  private alive(): boolean {
    if (!this.ready || this.child == null || this.link == null) return false
    if (this.child.exitCode != null || this.child.signalCode != null) return false
    if (this.link.signal.aborted) return false
    return true
  }

  private useMcpServers(servers: AcpMcpServer[]): void {
    this.mcpServers = servers.map((server) => ({
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env ?? []
    }))
  }

  private requireAgent(): ClientConnection['agent'] {
    if (!this.link) throw new Error('agent is not running')
    return this.link.agent
  }

  private async openProcess(): Promise<void> {
    this.link?.close()
    this.link = null
    this.ready = false
    this.authenticated = false
    const child = spawn(this.options.command, [...this.options.args], {
      cwd: this.cwd,
      env: process.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child = child
    this.stderrLogged = 0
    child.stderr?.on('data', (chunk: Buffer) => {
      this.captureStderr(chunk)
    })
    child.on('error', (error) => {
      this.writeLog(error.message)
    })
    child.on('exit', (code, signal) => {
      this.ready = false
      if (this.killTimer) {
        clearTimeout(this.killTimer)
        this.killTimer = null
      }
      if (this.turn && !this.disposed) {
        this.finishTurn('error', `agent exited ${code ?? signal ?? 'null'}`)
      }
    })
    if (!child.stdin || !child.stdout) throw new Error('spawn did not provide stdio pipes')
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EPIPE') this.writeLog(error.message)
    })

    const stream = ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    )
    const link = client({ name: 'MarkText' })
      .onRequest(methods.client.session.requestPermission, (ctx) => this.onPermission(ctx.params))
      .onNotification(methods.client.session.update, (ctx) => {
        this.onUpdate(ctx.params)
      })
      .connect(stream)
    link.signal.addEventListener('abort', () => {
      // The stdio stream ends before `exit` is delivered. The next send must
      // see the process as dead and start another one.
      this.ready = false
    })
    this.link = link

    const init = await withTimeout(
      link.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientInfo: { name: 'MarkText', version: clientVersion() },
        clientCapabilities: {}
      }),
      ACP_INIT_TIMEOUT_MS,
      'initialize'
    )
    this.agentVersion = typeof init.agentInfo?.version === 'string' ? init.agentInfo.version : null
    this.capabilities = init.agentCapabilities
    this.authMethods = init.authMethods ?? []
    this.ready = true
  }

  private async requestNew(params: { cwd: string, mcpServers: McpServer[] }): Promise<NewSessionResponse> {
    const agent = this.requireAgent()
    try {
      return await agent.request(methods.agent.session.new, params)
    } catch (error) {
      if (!this.canAuthenticate(error)) throw this.asAuthError(error)
      await this.authenticate()
      try {
        return await agent.request(methods.agent.session.new, params)
      } catch (retryError) {
        throw this.asAuthError(retryError)
      }
    }
  }

  private canAuthenticate(error: unknown): boolean {
    return isAuthRequired(error) &&
      this.authMethods.length > 0 &&
      !!this.options.quirks.authMethodId &&
      !this.authenticated
  }

  private async authenticate(): Promise<void> {
    const methodId = this.options.quirks.authMethodId
    if (!methodId) throw new AcpAuthRequiredError(authHint(this.options.harness))
    try {
      await this.requireAgent().request(methods.agent.authenticate, { methodId })
      this.authenticated = true
    } catch {
      throw new AcpAuthRequiredError(authHint(this.options.harness))
    }
  }

  private asAuthError(error: unknown): Error {
    if (isAuthRequired(error)) return new AcpAuthRequiredError(authHint(this.options.harness))
    if (error instanceof Error) return error
    return new Error(String(error))
  }

  private rememberModel(options: { id: string, category?: string | null }[] | null | undefined): void {
    const model = options?.find((option) => option.category === 'model')
    if (model) this.modelConfigId = model.id
  }

  private async onPermission(params: RequestPermissionRequest): Promise<{
    outcome: { outcome: 'cancelled' } | { outcome: 'selected', optionId: string }
  }> {
    const request: PermissionRequest = {
      requestId: randomUUID(),
      title: params.toolCall.title || 'Permission',
      options: params.options.flatMap((option) => {
        if (!isPermissionKind(option.kind)) return []
        return [{ id: option.optionId, label: option.name, kind: option.kind }]
      })
    }
    const pending = waitForPermissionAnswer(request.requestId)
    this.pendingPermission = request.requestId
    this.options.onEvent({ type: 'permission_request', request })
    const answer = await pending
    if (this.pendingPermission === request.requestId) this.pendingPermission = null
    if (answer === 'cancelled') return { outcome: { outcome: 'cancelled' } }
    return { outcome: { outcome: 'selected', optionId: answer } }
  }

  private onUpdate(notification: SessionNotification): void {
    const update = notification.update
    const event = this.eventFor(update)
    if (!event) {
      this.writeLog(`skipped session update ${update.sessionUpdate}`)
      return
    }
    if (Array.isArray(event)) {
      for (const item of event) this.options.onEvent(item)
      return
    }
    this.options.onEvent(event)
  }

  private eventFor(update: SessionUpdate): ChatEvent | ChatEvent[] | null {
    switch (update.sessionUpdate) {
      case 'user_message_chunk':
      case 'agent_message_chunk':
      case 'agent_thought_chunk': {
        const text = textOf(update.content)
        if (text == null) return null
        const messageId = update.messageId || randomUUID()
        if (update.sessionUpdate === 'agent_thought_chunk') {
          return { type: 'thought_chunk', messageId, text }
        }
        return {
          type: 'message_chunk',
          role: update.sessionUpdate === 'user_message_chunk' ? 'user' : 'agent',
          messageId,
          text
        }
      }
      case 'tool_call':
      case 'tool_call_update': {
        const locations = (update.locations ?? []).map((location) => repoRelative(this.cwd, location.path))
        const diffPaths = update.sessionUpdate === 'tool_call_update'
          ? (update.content ?? []).flatMap((item) =>
            item.type === 'diff' ? [repoRelative(this.cwd, item.path)] : []
          )
          : []
        this.track([...locations, ...diffPaths])
        const status: ToolCallStatus = update.status ?? 'pending'
        const title = update.title || update.toolCallId
        if (update.sessionUpdate === 'tool_call') {
          return { type: 'tool_call', toolCallId: update.toolCallId, title, status, locations }
        }
        return {
          type: 'tool_call_update',
          toolCallId: update.toolCallId,
          title,
          status,
          locations,
          diffPaths
        }
      }
      case 'plan':
        return { type: 'plan', text: update.entries.map((entry) => entry.content).join('\n') }
      default:
        return null
    }
  }

  private track(paths: string[]): void {
    if (!this.turn) return
    for (const filePath of paths) {
      if (!this.turn.changed.includes(filePath)) this.turn.changed.push(filePath)
    }
  }

  private finishTurn(stopReason: TurnStopReason, message?: string): void {
    const turn = this.turn
    if (!turn) return
    this.turn = null
    if (this.options.onTurnEnd) {
      this.options.onTurnEnd({ turnId: turn.id, stopReason, message })
      return
    }
    if (stopReason === 'error' && message) {
      this.options.onEvent({ type: 'error', message })
    }
    this.options.onEvent({
      type: 'turn_finished',
      turnId: turn.id,
      stopReason,
      changedPaths: turn.changed,
      missingReplyThreadIds: []
    })
  }

  private captureStderr(chunk: Buffer): void {
    if (this.stderrLogged >= STDERR_LIMIT) return
    const text = chunk.toString('utf8').slice(0, STDERR_LIMIT - this.stderrLogged)
    this.stderrLogged += text.length
    if (text) this.writeLog(text)
  }

  private async killChild(): Promise<void> {
    const child = this.child
    if (!child || child.exitCode != null || child.signalCode != null) return
    await new Promise<void>((resolve) => {
      child.once('exit', () => {
        if (this.killTimer) {
          clearTimeout(this.killTimer)
          this.killTimer = null
        }
        resolve()
      })
      if (process.platform === 'win32') {
        if (child.pid == null) {
          child.kill()
          return
        }
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          shell: false,
          stdio: 'ignore',
          windowsHide: true
        })
        killer.on('error', () => {
          child.kill()
        })
        return
      }
      child.kill('SIGTERM')
      this.killTimer = setTimeout(() => {
        if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL')
      }, this.options.killGraceMs ?? KILL_GRACE_MS)
    })
  }
}

const isPermissionKind = (kind: string): kind is PermissionOptionKind =>
  PERMISSION_KINDS.includes(kind as PermissionOptionKind)
