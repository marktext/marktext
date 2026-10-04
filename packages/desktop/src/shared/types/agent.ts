/**
 * Editor-facing agent session types. `ChatEvent` is the normalized ACP
 * surface the renderer is allowed to see; raw JSON-RPC stays in main.
 */

export const HARNESS_IDS = ['opencode', 'pi', 'cursor'] as const

export type HarnessId = (typeof HARNESS_IDS)[number]

export const MODEL_PROBE_TIMEOUT_MS = 20_000
export const ACP_INIT_TIMEOUT_MS = 15_000
export const HISTORY_REPLAY_MAX_CHARS = 40_000
export const MCP_SERVER_NAME = 'marktext'
export const MCP_TOOL_REPLY = 'reply_to_thread'

const HARNESS_ID_SET: ReadonlySet<string> = new Set(HARNESS_IDS)

export const isHarnessId = (value: unknown): value is HarnessId =>
  typeof value === 'string' && HARNESS_ID_SET.has(value)

/** Null `reason` means the binary answered `initialize` and can be used. */
export type HarnessStatusReason =
  | 'not_found'
  | 'not_executable'
  | 'auth_required'
  | 'no_models'
  | 'init_failed'

export interface HarnessStatus {
  id: HarnessId
  found: boolean
  resolvedPath: string | null
  version: string | null
  reason: HarnessStatusReason | null
  /** Detail for `init_failed`; null for every other reason. */
  message: string | null
}

export interface ModelOption {
  id: string
  label: string
}

export type ListModelsResult =
  | { ok: true; models: ModelOption[] }
  | { ok: false; reason: HarnessStatusReason }

export type RepoState =
  | { kind: 'none' }
  | { kind: 'repo'; root: string; userName: string }

/** Model for the current repository. The harness is the `agentHarness` preference. */
export interface AgentSelection {
  model: string
}

/**
 * Where the renderer found the quote when it asked to send threads.
 * Line numbers are inclusive and 1-based. `orphaned` is not stored on the thread.
 */
export interface ThreadPlacement {
  threadId: string
  orphaned: boolean
  lines?: { start: number; end: number }
}

export interface SessionSummary {
  id: string
  title: string
  model: string
  createdAt: string
  updatedAt: string
  /** Absent when this harness cannot resume and the ACP id was not kept. */
  acpSessionId: string | null
}

export type TurnStopReason = 'end_turn' | 'cancelled' | 'max_tokens' | 'refusal' | 'error'

export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type PermissionOptionKind = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always'

export interface PermissionOption {
  id: string
  label: string
  kind: PermissionOptionKind
}

export interface PermissionRequest {
  requestId: string
  title: string
  options: PermissionOption[]
}

export type ChatEvent =
  | {
    type: 'message_chunk'
      /** `user` is the prompt we sent; `agent` is the model's reply. */
    role: 'user' | 'agent'
    messageId: string
    text: string
  }
  | { type: 'thought_chunk'; messageId: string; text: string }
  | {
    type: 'tool_call'
    toolCallId: string
    title: string
    status: ToolCallStatus
      /** Repo-relative POSIX paths. Empty until the harness reports any. */
    locations: string[]
  }
  | {
    type: 'tool_call_update'
    toolCallId: string
    title: string
    status: ToolCallStatus
    locations: string[]
      /** Repo-relative POSIX paths taken from ACP diff content. */
    diffPaths: string[]
  }
  | { type: 'plan'; text: string }
  | { type: 'permission_request'; request: PermissionRequest }
  | { type: 'turn_started'; turnId: string }
  | {
    type: 'turn_finished'
    turnId: string
    stopReason: TurnStopReason
    changedPaths: string[]
    missingReplyThreadIds: string[]
  }
  | { type: 'error'; message: string }

export interface TurnRecord {
  id: string
  /** Null for a free-form chat message that was not tied to a file. */
  file: string | null
  threadIds: string[]
  startedAt: string
  finishedAt: string
  stopReason: TurnStopReason
  changedPaths: string[]
  missingReplyThreadIds: string[]
}

export interface SessionSnapshot {
  summary: SessionSummary
  events: ChatEvent[]
  model: string
  resumable: boolean
}
