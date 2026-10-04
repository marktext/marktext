import type { ChatEvent, PermissionRequest, ToolCallStatus } from '@shared/types/agent'

export interface ToolRow {
  type: 'tool'
  id: string
  title: string
  status: ToolCallStatus
  locations: string[]
  diffPaths: string[]
}

export type TurnBody =
  | { type: 'thought'; messageId: string; text: string }
  | { type: 'agent'; messageId: string; text: string }
  | { type: 'plan'; text: string }
  | { type: 'permission'; request: PermissionRequest }
  | ToolRow

export interface ChatTurn {
  key: string
  userText: string | null
  body: TurnBody[]
  finished: Extract<ChatEvent, { type: 'turn_finished' }> | null
  error: string | null
}

const REPLY_TOOL = /reply_to_thread/i

/** A comments send is the prompt built for threads, not a free-form message. */
export const commentsCard = (text: string): { file: string; count: number } | null => {
  const file = text.match(/^File: (.+)$/m)?.[1]?.trim()
  const count = text.match(/^### Thread /gm)?.length ?? 0
  if (!file || count === 0) return null
  return { file, count }
}

/** The replies fence stays in the transcript but is not part of the visible answer. */
export const splitRepliesFence = (source: string): { prose: string; fences: string[] } => {
  const fences: string[] = []
  const prose = source.replace(/```marktext-replies\n([\s\S]*?)```/g, (_all, body: string) => {
    fences.push(body.trim())
    return ''
  }).trim()
  return { prose, fences }
}

export const isReplyTool = (title: string): boolean => REPLY_TOOL.test(title)

export const replyThreadId = (title: string): string | null => {
  const match = title.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return match?.[0] ?? null
}

const blankTurn = (key: string): ChatTurn => ({
  key,
  userText: null,
  body: [],
  finished: null,
  error: null
})

/**
 * One section per user send. Tool updates replace the row they belong to.
 * `turn_started` before the user text stays on that same section.
 */
export const groupTurns = (events: readonly ChatEvent[]): ChatTurn[] => {
  const turns: ChatTurn[] = []
  let current: ChatTurn | null = null
  let tools = new Map<string, ToolRow>()

  const start = (key: string): ChatTurn => {
    const turn = blankTurn(key)
    turns.push(turn)
    tools = new Map()
    return turn
  }

  const ensure = (): ChatTurn => {
    if (current) return current
    current = start(`turn-${turns.length}`)
    return current
  }

  for (const event of events) {
    if (event.type === 'turn_started') {
      if (current == null || current.finished) current = start(event.turnId)
      else current.key = event.turnId
      continue
    }
    if (event.type === 'message_chunk' && event.role === 'user') {
      if (current == null || current.finished || current.userText) current = start(event.messageId)
      current.userText = event.text
      continue
    }
    if (event.type === 'message_chunk') {
      ensure().body.push({ type: 'agent', messageId: event.messageId, text: event.text })
      continue
    }
    if (event.type === 'thought_chunk') {
      ensure().body.push({ type: 'thought', messageId: event.messageId, text: event.text })
      continue
    }
    if (event.type === 'plan') {
      ensure().body.push({ type: 'plan', text: event.text })
      continue
    }
    if (event.type === 'permission_request') {
      ensure().body.push({ type: 'permission', request: event.request })
      continue
    }
    if (event.type === 'tool_call' || event.type === 'tool_call_update') {
      const turn = ensure()
      const prior = tools.get(event.toolCallId)
      const row: ToolRow = {
        type: 'tool',
        id: event.toolCallId,
        title: event.title || prior?.title || event.toolCallId,
        status: event.status,
        locations: event.locations.length > 0 ? [...event.locations] : [...(prior?.locations ?? [])],
        diffPaths: event.type === 'tool_call_update'
          ? [...(prior?.diffPaths ?? []), ...event.diffPaths]
          : [...(prior?.diffPaths ?? [])]
      }
      if (prior) {
        const index = turn.body.indexOf(prior)
        if (index >= 0) turn.body.splice(index, 1, row)
      } else {
        turn.body.push(row)
      }
      tools.set(event.toolCallId, row)
      continue
    }
    if (event.type === 'error') {
      const turn = ensure()
      turn.error = turn.error ? `${turn.error}\n${event.message}` : event.message
      continue
    }
    if (event.type === 'turn_finished') {
      ensure().finished = event
      current = null
    }
  }
  return turns
}
