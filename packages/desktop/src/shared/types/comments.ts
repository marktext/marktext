/**
 * On-disk comment threads (`.marktext/comments/**`). `serializeCommentsFile`
 * is the byte layout: fixed key order, threads and messages sorted by
 * `createdAt`, so a git diff of the JSON stays reviewable.
 */

import { isHarnessId, type HarnessId } from './agent'

export const COMMENTS_DIR = '.marktext/comments'
export const COMMENTS_FILE_VERSION = 1 as const
export const ANCHOR_CONTEXT_CHARS = 32
export const REANCHOR_DEBOUNCE_MS = 400
export const HUMAN_FALLBACK_NAME = 'me'
export const REPLY_MAX_CHARS = 20_000
export const REPLY_BLOCK_LANG = 'marktext-replies'

export type ThreadStatus = 'open' | 'closed'

export interface BlockHint {
  type: string
  /** Zero-based index of that block type in the file. */
  index: number
}

export interface Anchor {
  quote: string
  prefix: string
  suffix: string
  blockHint: BlockHint
}

export interface HumanAuthor {
  kind: 'human'
  name: string
}

export interface AgentAuthor {
  kind: 'agent'
  harness: HarnessId
  model: string
}

export interface HumanMessage {
  id: string
  author: HumanAuthor
  text: string
  createdAt: string
  editedAt: string | null
}

export interface AgentMessage {
  id: string
  author: AgentAuthor
  text: string
  createdAt: string
  turnId: string
}

export type Message = HumanMessage | AgentMessage

export interface Thread {
  id: string
  status: ThreadStatus
  createdAt: string
  closedAt: string | null
  anchor: Anchor
  messages: Message[]
}

export interface CommentsFile {
  version: typeof COMMENTS_FILE_VERSION
  /** POSIX path relative to the repository root. */
  file: string
  threads: Thread[]
}

export type CommentsMutation =
  | { op: 'createThread'; file: string; anchor: Anchor; firstText: string }
  | { op: 'addHumanMessage'; threadId: string; text: string }
  | { op: 'editHumanMessage'; messageId: string; text: string }
  | { op: 'deleteHumanMessage'; messageId: string }
  | { op: 'setStatus'; threadId: string; status: ThreadStatus }
  | { op: 'deleteThread'; threadId: string }
  | { op: 'appendAgentReply'; turnId: string; threadId: string; text: string }
  | { op: 'moveFile'; oldPath: string; newPath: string }

export type CommentsLoadResult =
  | { kind: 'ok'; file: CommentsFile }
  | { kind: 'parse_error'; path: string; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

/** Repository-relative POSIX path. Absolute paths and backslashes are not stored. */
const isRepoPath = (value: unknown): value is string =>
  isNonEmptyString(value) && !value.startsWith('/') && !value.includes('\\')

const isAnchor = (value: unknown): value is Anchor => {
  if (!isRecord(value)) return false
  if (typeof value.quote !== 'string' || value.quote.length === 0) return false
  if (typeof value.prefix !== 'string' || value.prefix.length > ANCHOR_CONTEXT_CHARS) return false
  if (typeof value.suffix !== 'string' || value.suffix.length > ANCHOR_CONTEXT_CHARS) return false
  if (!isRecord(value.blockHint)) return false
  return (
    isNonEmptyString(value.blockHint.type) &&
    typeof value.blockHint.index === 'number' &&
    Number.isInteger(value.blockHint.index) &&
    value.blockHint.index >= 0
  )
}

const isHumanMessage = (value: unknown): value is HumanMessage => {
  if (!isRecord(value) || !isRecord(value.author) || value.author.kind !== 'human') return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.author.name) &&
    typeof value.text === 'string' &&
    isNonEmptyString(value.createdAt) &&
    isNullableString(value.editedAt)
  )
}

const isAgentMessage = (value: unknown): value is AgentMessage => {
  if (!isRecord(value) || !isRecord(value.author) || value.author.kind !== 'agent') return false
  return (
    isNonEmptyString(value.id) &&
    isHarnessId(value.author.harness) &&
    isNonEmptyString(value.author.model) &&
    typeof value.text === 'string' &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.turnId)
  )
}

const isMessage = (value: unknown): value is Message =>
  isHumanMessage(value) || isAgentMessage(value)

const isHuman = (message: Message): message is HumanMessage => message.author.kind === 'human'

const isThread = (value: unknown): value is Thread => {
  if (!isRecord(value)) return false
  if (value.status !== 'open' && value.status !== 'closed') return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.createdAt)) return false
  if (!isNullableString(value.closedAt) || !isAnchor(value.anchor)) return false
  return Array.isArray(value.messages) && value.messages.every(isMessage)
}

export const isCommentsFile = (value: unknown): value is CommentsFile => {
  if (!isRecord(value)) return false
  if (value.version !== COMMENTS_FILE_VERSION || !isRepoPath(value.file)) return false
  return Array.isArray(value.threads) && value.threads.every(isThread)
}

const byCreatedAt = (a: { createdAt: string }, b: { createdAt: string }): number => {
  if (a.createdAt < b.createdAt) return -1
  if (a.createdAt > b.createdAt) return 1
  return 0
}

const serializeMessage = (message: Message): HumanMessage | AgentMessage => {
  if (isHuman(message)) {
    return {
      id: message.id,
      author: { kind: 'human', name: message.author.name },
      text: message.text,
      createdAt: message.createdAt,
      editedAt: message.editedAt
    }
  }
  return {
    id: message.id,
    author: {
      kind: 'agent',
      harness: message.author.harness,
      model: message.author.model
    },
    text: message.text,
    createdAt: message.createdAt,
    turnId: message.turnId
  }
}

const serializeThread = (thread: Thread): Thread => ({
  id: thread.id,
  status: thread.status,
  createdAt: thread.createdAt,
  closedAt: thread.closedAt,
  anchor: {
    quote: thread.anchor.quote,
    prefix: thread.anchor.prefix,
    suffix: thread.anchor.suffix,
    blockHint: {
      type: thread.anchor.blockHint.type,
      index: thread.anchor.blockHint.index
    }
  },
  messages: [...thread.messages].sort(byCreatedAt).map(serializeMessage)
})

export const serializeCommentsFile = (file: CommentsFile): string => {
  const body: CommentsFile = {
    version: file.version,
    file: file.file,
    threads: [...file.threads].sort(byCreatedAt).map(serializeThread)
  }
  return `${JSON.stringify(body, null, 2)}\n`
}
