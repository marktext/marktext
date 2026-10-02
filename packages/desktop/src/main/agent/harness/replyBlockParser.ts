import type { ChatEvent } from '@shared/types/agent'
import { REPLY_BLOCK_LANG } from '@shared/types/comments'
import { commentsService } from '../comments/commentsService'

export interface BlockReply {
  threadId: string
  text: string
}

export type ReplyBlockParse =
  | { kind: 'absent' }
  | { kind: 'invalid'; message: string }
  | { kind: 'replies'; replies: BlockReply[] }

const NOT_SAVED = 'No replies were saved.'

interface Opener {
  index: number
  marker: string
  size: number
}

const openerAt = (line: string): Opener | null => {
  const match = /^(?: {0,3})(`{3,}|~{3,})([^`]*)$/.exec(line)
  if (!match) return null
  const marker = match[1]
  const info = match[2].trim()
  const language = info.split(/\s+/)[0] ?? ''
  if (language !== REPLY_BLOCK_LANG) return null
  if (marker[0] === '`' && info.includes('`')) return null
  return { index: -1, marker: marker[0], size: marker.length }
}

const closes = (line: string, opener: Opener): boolean => {
  const match = /^(?: {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line)
  if (!match) return false
  return match[1][0] === opener.marker && match[1].length >= opener.size
}

const isReply = (value: unknown): value is BlockReply => {
  if (!value || typeof value !== 'object') return false
  const reply = value as { threadId?: unknown, text?: unknown }
  return typeof reply.threadId === 'string' && reply.threadId.length > 0 && typeof reply.text === 'string'
}

/**
 * The last `marktext-replies` fence in the agent's final text. The fence stays
 * in the saved transcript; the renderer collapses it.
 */
export const parseReplyBlock = (agentText: string): ReplyBlockParse => {
  const lines = agentText.split('\n')
  let opener: Opener | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const found = openerAt(lines[index])
    if (found) opener = { ...found, index }
  }
  if (!opener) return { kind: 'absent' }

  let closeAt = -1
  for (let index = opener.index + 1; index < lines.length; index += 1) {
    if (closes(lines[index], opener)) {
      closeAt = index
      break
    }
  }
  if (closeAt === -1) {
    return { kind: 'invalid', message: `The marktext-replies block is not closed. ${NOT_SAVED}` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(lines.slice(opener.index + 1, closeAt).join('\n'))
  } catch {
    return { kind: 'invalid', message: `The marktext-replies block is not valid JSON. ${NOT_SAVED}` }
  }
  if (!Array.isArray(parsed) || !parsed.every(isReply)) {
    return {
      kind: 'invalid',
      message: `The marktext-replies block must be a JSON array of { threadId, text }. ${NOT_SAVED}`
    }
  }
  return { kind: 'replies', replies: parsed.map((reply) => ({ threadId: reply.threadId, text: reply.text })) }
}

/**
 * `repliesVia: 'block'` writes each parsed reply through `appendAgentReply`.
 * An unreadable block emits a chat warning and writes nothing. `mcp` leaves
 * the text alone: those replies already arrived through the tool.
 */
export const applyBlockReplies = async(input: {
  repliesVia: 'mcp' | 'block'
  windowId: number
  root: string
  turnId: string
  agentText: string
}): Promise<ChatEvent | null> => {
  if (input.repliesVia !== 'block') return null
  const parsed = parseReplyBlock(input.agentText)
  if (parsed.kind === 'absent') return null
  if (parsed.kind === 'invalid') return { type: 'error', message: parsed.message }
  for (const reply of parsed.replies) {
    await commentsService().apply(input.windowId, input.root, {
      op: 'appendAgentReply',
      turnId: input.turnId,
      threadId: reply.threadId,
      text: reply.text
    })
  }
  return null
}
