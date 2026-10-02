import { REPLY_BLOCK_LANG, type Message, type Thread } from '@shared/types/comments'

/**
 * Where the renderer found the quote. Line numbers are inclusive and are
 * printed as given. `orphaned` is not stored on the thread.
 */
export interface ThreadPlacement {
  threadId: string
  orphaned: boolean
  lines?: { start: number; end: number }
}

export interface BuildThreadsMessageInput {
  file: string
  threads: readonly Thread[]
  anchors: readonly ThreadPlacement[]
  repliesVia: 'mcp' | 'block'
}

const MCP_RULE = [
  '- For EACH thread, call the MCP tool `marktext.reply_to_thread` exactly once with',
  '  { "threadId": "<id>", "text": "<your answer>" } describing what you did or why not.'
].join('\n')

const BLOCK_RULE = [
  '- Finish your reply with this block. One object for EACH thread, describing what you did or why not:',
  '',
  '```' + REPLY_BLOCK_LANG,
  '[{"threadId": "<id>", "text": "<your answer>"}]',
  '```'
].join('\n')

const RULES_TAIL = [
  '- Write each reply in the same language as the human messages of that thread.',
  '- Do not change thread status, do not delete threads, do not edit `.marktext/comments/**` directly.',
  '- A thread marked ORPHANED means the quoted text was not found in the current file; use the',
  '  quote and messages to locate the intent, or explain in your reply why you could not.'
].join('\n')

interface PlacedThread {
  thread: Thread
  orphaned: boolean
  lines?: { start: number; end: number }
}

const compareText = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const hasLines = (placed: PlacedThread): placed is PlacedThread & { lines: { start: number; end: number } } =>
  !placed.orphaned && placed.lines != null

/** Anchored threads follow the quote's line range. Orphans stay in creation order after them. */
const byFilePosition = (left: PlacedThread, right: PlacedThread): number => {
  const leftLines = hasLines(left)
  const rightLines = hasLines(right)
  if (leftLines !== rightLines) return leftLines ? -1 : 1
  if (leftLines && rightLines) {
    if (left.lines.start !== right.lines.start) return left.lines.start - right.lines.start
    if (left.lines.end !== right.lines.end) return left.lines.end - right.lines.end
  } else if (left.orphaned !== right.orphaned) {
    return left.orphaned ? 1 : -1
  }
  const created = compareText(left.thread.createdAt, right.thread.createdAt)
  if (created !== 0) return created
  return compareText(left.thread.id, right.thread.id)
}

const quoteLines = (quote: string): string =>
  quote.replace(/\r\n?/g, '\n').split('\n').map((line) => `> ${line}`).join('\n')

const messageLine = (message: Message): string => {
  const who = message.author.kind === 'human'
    ? `human: ${message.author.name}`
    : `agent: ${message.author.harness}/${message.author.model}`
  return `- [${who}, ${message.createdAt}] ${message.text}`
}

const statusLine = (placed: PlacedThread): string => {
  if (placed.orphaned) return 'Status: ORPHANED (quote not found in file)'
  if (!placed.lines) return 'Status: anchored'
  return `Status: anchored (lines ${placed.lines.start}-${placed.lines.end})`
}

const renderThread = (placed: PlacedThread): string => {
  const messages = [...placed.thread.messages].sort((left, right) => {
    const created = compareText(left.createdAt, right.createdAt)
    return created !== 0 ? created : compareText(left.id, right.id)
  })
  return [
    `### Thread ${placed.thread.id}`,
    statusLine(placed),
    'Quote:',
    quoteLines(placed.thread.anchor.quote),
    'Messages:',
    ...messages.map(messageLine)
  ].join('\n')
}

const placeThreads = (threads: readonly Thread[], anchors: readonly ThreadPlacement[]): PlacedThread[] => {
  const byId = new Map<string, ThreadPlacement>()
  for (const anchor of anchors) {
    if (!byId.has(anchor.threadId)) byId.set(anchor.threadId, anchor)
  }
  return threads.map((thread) => {
    const anchor = byId.get(thread.id)
    const orphaned = !anchor || anchor.orphaned
    return {
      thread,
      orphaned,
      lines: orphaned ? undefined : anchor?.lines
    }
  }).sort(byFilePosition)
}

/**
 * One `session/prompt` body, saved in the transcript as sent. A thread with
 * no anchor is ORPHANED and listed after the anchored threads.
 */
export const buildThreadsMessage = (input: BuildThreadsMessageInput): string => {
  const replyRule = input.repliesVia === 'block' ? BLOCK_RULE : MCP_RULE
  const intro = [
    'You are reviewing comments left by a human on a Markdown document in this repository.',
    '',
    'Rules:',
    '- Address every thread below. You may edit any files in the repository.',
    replyRule,
    RULES_TAIL,
    '',
    `File: ${input.file}`,
    ''
  ].join('\n')
  const body = placeThreads(input.threads, input.anchors).map(renderThread).join('\n\n')
  return body.length > 0 ? `${intro}\n${body}\n` : intro
}
