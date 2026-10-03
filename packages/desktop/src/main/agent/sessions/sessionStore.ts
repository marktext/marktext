import { createHash, randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {
  isHarnessId,
  type AgentSelection,
  type ChatEvent,
  type HarnessId,
  type PermissionRequest,
  type SessionSnapshot,
  type SessionSummary,
  type ToolCallStatus,
  type TurnStopReason
} from '@shared/types/agent'

const TITLE_LIMIT = 60
const COMMENTS_TITLE = 'Комментарии: '
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/

export class SessionStoreError extends Error {
  readonly code: 'not_found' | 'bad_harness' | 'bad_selection'

  constructor(code: SessionStoreError['code'], message: string) {
    super(message)
    this.name = 'SessionStoreError'
    this.code = code
  }
}

/** One jsonl line. Names match the transcript layout in the session contract. */
export type SessionLine =
  | { type: 'user_message'; messageId: string; text: string }
  | { type: 'agent_message'; messageId: string; text: string }
  | { type: 'thought'; messageId: string; text: string }
  | { type: 'tool_call'; toolCallId: string; title: string; status: ToolCallStatus; locations: string[] }
  | {
    type: 'tool_call_update'
    toolCallId: string
    title: string
    status: ToolCallStatus
    locations: string[]
    diffPaths: string[]
  }
  | { type: 'permission'; request: PermissionRequest }
  | { type: 'plan'; text: string }
  | { type: 'error'; message: string }
  | { type: 'turn_started'; turnId: string }
  | {
    type: 'turn_finished'
    turnId: string
    stopReason: TurnStopReason
    changedPaths: string[]
    missingReplyThreadIds: string[]
    /** Present when the line is the persisted `TurnRecord`. */
    file?: string | null
    threadIds?: string[]
    startedAt?: string
    finishedAt?: string
  }

interface RepoEntry {
  model: string | null
  lastSession: Partial<Record<HarnessId, string>>
}

type ReposFile = Record<string, RepoEntry>

export interface CreateSessionOptions {
  /**
   * Comments session. The title stays `Комментарии: <file>` and is not
   * replaced by the generated prompt.
   */
  file?: string
}

export interface SessionStoreOptions {
  now?: () => string
  newId?: () => string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Same folder identity as the window registry, so one repository has one transcript directory. */
const canonicalRoot = (root: string): string =>
  process.platform === 'win32' ? path.win32.normalize(root) : path.resolve(root)

const rootKey = (root: string): string => {
  const canonical = canonicalRoot(root)
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical
}

/** Directory name for a repository. The path itself is the `repos.json` key. */
export const repoHash = (root: string): string =>
  createHash('sha256').update(rootKey(root)).digest('hex').slice(0, 16)

const titleFromMessage = (text: string): string =>
  Array.from(text.trim()).slice(0, TITLE_LIMIT).join('')

const commentsTitle = (file: string): string => `${COMMENTS_TITLE}${file}`

const emptyRepo = (): RepoEntry => ({ model: null, lastSession: {} })

const modelText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

/**
 * `repos.json` used to store `{ selection: { harness, model } }`. The harness
 * moved to the `agentHarness` preference, so only the model is kept.
 */
const modelFromRepo = (value: Record<string, unknown>): string | null => {
  const direct = modelText(value.model)
  if (direct) return direct
  if (!isRecord(value.selection)) return null
  return modelText(value.selection.model)
}

const parseRepos = (raw: string): ReposFile => {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) return {}
  const repos: ReposFile = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue
    const lastSession: Partial<Record<HarnessId, string>> = {}
    if (isRecord(value.lastSession)) {
      for (const [harness, sessionId] of Object.entries(value.lastSession)) {
        if (isHarnessId(harness) && typeof sessionId === 'string' && sessionId.length > 0) {
          lastSession[harness] = sessionId
        }
      }
    }
    repos[key] = {
      model: modelFromRepo(value),
      lastSession
    }
  }
  return repos
}

const isSummary = (value: unknown): value is SessionSummary => {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' &&
    SAFE_SESSION_ID.test(value.id) &&
    typeof value.title === 'string' &&
    typeof value.model === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.acpSessionId === null || typeof value.acpSessionId === 'string')
}

const parseIndex = (raw: string): SessionSummary[] => {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isSummary)
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const isStopReason = (value: unknown): value is TurnStopReason =>
  value === 'end_turn' || value === 'cancelled' || value === 'max_tokens' || value === 'refusal' || value === 'error'

const isToolStatus = (value: unknown): value is ToolCallStatus =>
  value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'failed'

const isPermission = (value: unknown): value is PermissionRequest => {
  if (!isRecord(value) || typeof value.requestId !== 'string' || typeof value.title !== 'string') return false
  return Array.isArray(value.options)
}

/** Drop a line the process did not finish writing. Unknown kinds are ignored. */
const toChatEvent = (value: unknown): ChatEvent | null => {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  switch (value.type) {
    case 'user_message':
    case 'agent_message':
      if (typeof value.messageId !== 'string' || typeof value.text !== 'string') return null
      return {
        type: 'message_chunk',
        role: value.type === 'user_message' ? 'user' : 'agent',
        messageId: value.messageId,
        text: value.text
      }
    case 'thought':
      if (typeof value.messageId !== 'string' || typeof value.text !== 'string') return null
      return { type: 'thought_chunk', messageId: value.messageId, text: value.text }
    case 'tool_call':
      if (typeof value.toolCallId !== 'string' || typeof value.title !== 'string' || !isToolStatus(value.status)) return null
      return {
        type: 'tool_call',
        toolCallId: value.toolCallId,
        title: value.title,
        status: value.status,
        locations: asStringArray(value.locations)
      }
    case 'tool_call_update':
      if (typeof value.toolCallId !== 'string' || typeof value.title !== 'string' || !isToolStatus(value.status)) return null
      return {
        type: 'tool_call_update',
        toolCallId: value.toolCallId,
        title: value.title,
        status: value.status,
        locations: asStringArray(value.locations),
        diffPaths: asStringArray(value.diffPaths)
      }
    case 'permission':
      if (!isPermission(value.request)) return null
      return { type: 'permission_request', request: value.request }
    case 'plan':
      if (typeof value.text !== 'string') return null
      return { type: 'plan', text: value.text }
    case 'error':
      if (typeof value.message !== 'string') return null
      return { type: 'error', message: value.message }
    case 'turn_started':
      if (typeof value.turnId !== 'string') return null
      return { type: 'turn_started', turnId: value.turnId }
    case 'turn_finished':
      if (typeof value.turnId !== 'string' || !isStopReason(value.stopReason)) return null
      return {
        type: 'turn_finished',
        turnId: value.turnId,
        stopReason: value.stopReason,
        changedPaths: asStringArray(value.changedPaths),
        missingReplyThreadIds: asStringArray(value.missingReplyThreadIds)
      }
    default:
      return null
  }
}

/**
 * Transcripts under `<userData>/agent`. One directory per repository, named by
 * the first 16 hex chars of `sha256(repoRoot)`; `repos.json` keeps the path.
 * A jsonl line that was cut off by a crash is skipped.
 */
export class SessionStore {
  private tail: Promise<void> = Promise.resolve()

  constructor(
    private readonly agentDir: string,
    private readonly options: SessionStoreOptions = {}
  ) {}

  /**
   * The model saved for this repository. A repository that has none yet takes
   * `last-selection.json` only when that model is still in `available`.
   */
  getSelection(root: string, available?: readonly string[]): Promise<AgentSelection | null> {
    return this.enqueue(async() => {
      const saved = (await this.readRepos())[rootKey(root)]?.model
      if (saved) return { model: saved }
      const remembered = await this.readLastSelection()
      if (!remembered || !available?.includes(remembered)) return null
      return { model: remembered }
    })
  }

  /**
   * Stores the model on the repository. `used` also writes `last-selection.json`.
   * A finished turn calls `rememberUsed` instead, so a later header choice stays put.
   */
  setSelection(root: string, model: string, options?: { used?: boolean }): Promise<void> {
    if (!modelText(model)) throw new SessionStoreError('bad_selection', 'the model is required')
    return this.enqueue(async() => {
      const key = rootKey(root)
      const repos = await this.readRepos()
      const current = repos[key] ?? emptyRepo()
      repos[key] = { ...current, model }
      await this.writeJson(this.reposFile(), repos)
      if (options?.used) await this.writeJson(this.lastSelectionFile(), { model })
    })
  }

  /** Model that completed a turn. Does not replace the repository's header model. */
  rememberUsed(model: string): Promise<void> {
    if (!modelText(model)) throw new SessionStoreError('bad_selection', 'the model is required')
    return this.enqueue(async() => {
      await this.writeJson(this.lastSelectionFile(), { model })
    })
  }

  setAcpSessionId(
    root: string,
    harness: HarnessId,
    sessionId: string,
    acpSessionId: string | null
  ): Promise<void> {
    this.requireHarness(harness)
    return this.enqueue(async() => {
      const index = await this.readIndex(root, harness)
      const summary = index.find((item) => item.id === sessionId)
      if (!summary) throw new SessionStoreError('not_found', `session ${sessionId} was not found`)
      summary.acpSessionId = acpSessionId
      await this.writeJson(this.indexFile(root, harness), index)
    })
  }

  getLastSession(root: string, harness: HarnessId): Promise<string | null> {
    this.requireHarness(harness)
    return this.enqueue(async() => {
      return (await this.readRepos())[rootKey(root)]?.lastSession[harness] ?? null
    })
  }

  setLastSession(root: string, harness: HarnessId, sessionId: string): Promise<void> {
    this.requireHarness(harness)
    return this.enqueue(async() => {
      const key = rootKey(root)
      const repos = await this.readRepos()
      const current = repos[key] ?? emptyRepo()
      repos[key] = { ...current, lastSession: { ...current.lastSession, [harness]: sessionId } }
      await this.writeJson(this.reposFile(), repos)
    })
  }

  listSessions(root: string, harness: HarnessId): Promise<SessionSummary[]> {
    this.requireHarness(harness)
    return this.enqueue(async() => this.readIndex(root, harness))
  }

  createSession(
    root: string,
    harness: HarnessId,
    model: string,
    options?: CreateSessionOptions
  ): Promise<SessionSummary> {
    this.requireHarness(harness)
    if (model.length === 0) throw new SessionStoreError('bad_selection', 'the model is required')
    return this.enqueue(async() => {
      const now = this.now()
      const file = options?.file?.trim()
      const id = this.options.newId?.() ?? randomUUID()
      if (!SAFE_SESSION_ID.test(id)) throw new SessionStoreError('not_found', 'session id is not valid')
      const summary: SessionSummary = {
        id,
        title: file ? commentsTitle(file) : '',
        model,
        createdAt: now,
        updatedAt: now,
        acpSessionId: null
      }
      const key = rootKey(root)
      const repos = await this.readRepos()
      if (!repos[key]) {
        repos[key] = emptyRepo()
        await this.writeJson(this.reposFile(), repos)
      }
      const index = await this.readIndex(root, harness)
      index.push(summary)
      await this.writeJson(this.indexFile(root, harness), index)
      await fs.mkdir(this.sessionDir(root, harness), { recursive: true })
      await fs.writeFile(this.logFile(root, harness, summary.id), '')
      return summary
    })
  }

  appendEvent(root: string, harness: HarnessId, sessionId: string, line: SessionLine): Promise<void> {
    this.requireHarness(harness)
    return this.enqueue(async() => {
      const index = await this.readIndex(root, harness)
      const summary = index.find((item) => item.id === sessionId)
      if (!summary) throw new SessionStoreError('not_found', `session ${sessionId} was not found`)
      const file = this.logFile(root, harness, sessionId)
      await fs.mkdir(path.dirname(file), { recursive: true })
      const handle = await fs.open(file, 'a+')
      try {
        // A crash leaves the last line without a newline. The next event stays on its own line.
        const size = (await handle.stat()).size
        if (size > 0) {
          const tail = Buffer.alloc(1)
          await handle.read(tail, 0, 1, size - 1)
          if (tail[0] !== 0x0a) await handle.appendFile('\n')
        }
        await handle.appendFile(`${JSON.stringify(line)}\n`)
        if (line.type === 'turn_finished') await handle.sync()
      } finally {
        await handle.close()
      }
      summary.updatedAt = this.now()
      if (line.type === 'user_message' && summary.title.length === 0) {
        const titled = titleFromMessage(line.text)
        if (titled) summary.title = titled
      }
      await this.writeJson(this.indexFile(root, harness), index)
    })
  }

  readSession(root: string, harness: HarnessId, sessionId: string): Promise<SessionSnapshot> {
    this.requireHarness(harness)
    return this.enqueue(async() => {
      const summary = (await this.readIndex(root, harness)).find((item) => item.id === sessionId)
      if (!summary) throw new SessionStoreError('not_found', `session ${sessionId} was not found`)
      let raw = ''
      try {
        raw = await fs.readFile(this.logFile(root, harness, sessionId), 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const events: ChatEvent[] = []
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = toChatEvent(JSON.parse(line))
          if (event) events.push(event)
        } catch {
          // The last line of a crash is not a full JSON value.
        }
      }
      return {
        summary,
        events,
        model: summary.model,
        resumable: summary.acpSessionId != null
      }
    })
  }

  private requireHarness(harness: HarnessId): void {
    if (!isHarnessId(harness)) throw new SessionStoreError('bad_harness', 'unknown harness')
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString()
  }

  /** A failed write must not block the next one. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job)
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }

  private reposFile(): string {
    return path.join(this.agentDir, 'repos.json')
  }

  private lastSelectionFile(): string {
    return path.join(this.agentDir, 'last-selection.json')
  }

  private sessionDir(root: string, harness: HarnessId): string {
    return path.join(this.agentDir, 'sessions', repoHash(root), harness)
  }

  private indexFile(root: string, harness: HarnessId): string {
    return path.join(this.sessionDir(root, harness), 'index.json')
  }

  private logFile(root: string, harness: HarnessId, sessionId: string): string {
    if (!SAFE_SESSION_ID.test(sessionId)) throw new SessionStoreError('not_found', 'session id is not valid')
    return path.join(this.sessionDir(root, harness), `${sessionId}.jsonl`)
  }

  private async readRepos(): Promise<ReposFile> {
    try {
      return parseRepos(await fs.readFile(this.reposFile(), 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  }

  private async readLastSelection(): Promise<string | null> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.lastSelectionFile(), 'utf8'))
      if (typeof parsed === 'string') return modelText(parsed)
      if (!isRecord(parsed)) return null
      return modelText(parsed.model)
    } catch {
      return null
    }
  }

  private async readIndex(root: string, harness: HarnessId): Promise<SessionSummary[]> {
    try {
      return parseIndex(await fs.readFile(this.indexFile(root, harness), 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  private async writeJson(file: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
    await fs.rename(tmp, file)
  }
}
