import { describe, expect, it } from 'vitest'
import type { Message, Thread } from '@shared/types/comments'
import { buildThreadsMessage, type ThreadPlacement } from 'main_renderer/agent/turn/messageBuilder'

const anchor = (quote: string): Thread['anchor'] => ({
  quote,
  prefix: '',
  suffix: '',
  blockHint: { type: 'paragraph', index: 0 }
})

const human = (id: string, name: string, createdAt: string, text: string): Message => ({
  id,
  author: { kind: 'human', name },
  text,
  createdAt,
  editedAt: null
})

const agent = (id: string, createdAt: string, text: string): Message => ({
  id,
  author: { kind: 'agent', harness: 'opencode', model: 'anthropic/claude-sonnet-4-5' },
  text,
  createdAt,
  turnId: 'turn-1'
})

const thread = (
  id: string,
  createdAt: string,
  quote: string,
  messages: Message[]
): Thread => ({
  id,
  status: 'open',
  createdAt,
  closedAt: null,
  anchor: anchor(quote),
  messages
})

const SAMPLE_ID = 'c0f4f6a2-3b1e-4d8e-9a57-0d1c2b3a4f5e'

const sample = (): Thread => thread(
  SAMPLE_ID,
  '2026-10-02T12:00:05Z',
  'строгий режим TypeScript',
  [
    human('h1', 'Evgeniy', '2026-10-02T12:10:00Z', 'Ещё добавь ссылку на AGENTS.md.'),
    agent('a1', '2026-10-02T12:03:10Z', 'Исправил формулировку…'),
    human('h0', 'Evgeniy', '2026-10-02T12:00:05Z', 'Тут неточность, проверь tsconfig.')
  ]
)

const MCP_PROMPT = `You are reviewing comments left by a human on a Markdown document in this repository.

Rules:
- Address every thread below. You may edit any files in the repository.
- For EACH thread, call the MCP tool \`marktext.reply_to_thread\` exactly once with
  { "threadId": "<id>", "text": "<your answer>" } describing what you did or why not.
- Write each reply in the same language as the human messages of that thread.
- Do not change thread status, do not delete threads, do not edit \`.marktext/comments/**\` directly.
- A thread marked ORPHANED means the quoted text was not found in the current file; use the
  quote and messages to locate the intent, or explain in your reply why you could not.

File: docs/guide.md

### Thread ${SAMPLE_ID}
Status: anchored (lines 41-41)
Quote:
> строгий режим TypeScript
Messages:
- [human: Evgeniy, 2026-10-02T12:00:05Z] Тут неточность, проверь tsconfig.
- [agent: opencode/anthropic/claude-sonnet-4-5, 2026-10-02T12:03:10Z] Исправил формулировку…
- [human: Evgeniy, 2026-10-02T12:10:00Z] Ещё добавь ссылку на AGENTS.md.
`

describe('messageBuilder', () => {
  it('builds the contract prompt and orders messages by time', () => {
    const text = buildThreadsMessage({
      file: 'docs/guide.md',
      threads: [sample()],
      anchors: [{ threadId: SAMPLE_ID, orphaned: false, lines: { start: 41, end: 41 } }],
      repliesVia: 'mcp'
    })
    expect(text).toBe(MCP_PROMPT)
  })

  it('asks for a marktext-replies block when the harness does not call the tool', () => {
    const text = buildThreadsMessage({
      file: 'docs/guide.md',
      threads: [sample()],
      anchors: [{ threadId: SAMPLE_ID, orphaned: false, lines: { start: 41, end: 41 } }],
      repliesVia: 'block'
    })
    expect(text).not.toContain('marktext.reply_to_thread')
    expect(text).toContain([
      '- Finish your reply with this block. One object for EACH thread, describing what you did or why not:',
      '',
      '```marktext-replies',
      '[{"threadId": "<id>", "text": "<your answer>"}]',
      '```',
      '- Write each reply in the same language as the human messages of that thread.'
    ].join('\n'))
    expect(text).toContain('### Thread ' + SAMPLE_ID)
  })

  it('lists threads by line range and puts orphans last', () => {
    const earlyOrphan = thread('orphan-early', '2026-10-01T00:00:00Z', 'старая\nцитата', [
      human('o1', 'Ada', '2026-10-01T00:00:00Z', 'не нашла')
    ])
    const lateOrphan = thread('orphan-late', '2026-10-03T00:00:00Z', 'другая', [
      human('o2', 'Ada', '2026-10-03T00:00:00Z', 'тоже')
    ])
    const lower = thread('lower', '2026-10-02T00:00:00Z', 'ниже', [
      human('l1', 'Ada', '2026-10-02T00:00:00Z', 'низ')
    ])
    const upperShort = thread('upper-short', '2026-10-04T00:00:00Z', 'выше', [
      human('u1', 'Ada', '2026-10-04T00:00:00Z', 'верх')
    ])
    const upperLong = thread('upper-long', '2026-10-02T08:00:00Z', 'выше длиннее', [
      human('u2', 'Ada', '2026-10-02T08:00:00Z', 'длиннее')
    ])
    const missing = thread('missing', '2026-10-01T12:00:00Z', 'без якоря', [
      human('m1', 'Ada', '2026-10-01T12:00:00Z', 'нет привязки')
    ])
    const anchors: ThreadPlacement[] = [
      { threadId: 'lower', orphaned: false, lines: { start: 40, end: 42 } },
      { threadId: 'upper-long', orphaned: false, lines: { start: 10, end: 18 } },
      { threadId: 'upper-short', orphaned: false, lines: { start: 10, end: 10 } },
      { threadId: 'orphan-late', orphaned: true, lines: { start: 1, end: 1 } },
      { threadId: 'orphan-early', orphaned: true }
    ]

    const text = buildThreadsMessage({
      file: 'docs/guide.md',
      threads: [earlyOrphan, lower, lateOrphan, upperLong, missing, upperShort],
      anchors,
      repliesVia: 'mcp'
    })

    const ids = [...text.matchAll(/^### Thread (.+)$/gm)].map((match) => match[1])
    expect(ids).toEqual(['upper-short', 'upper-long', 'lower', 'orphan-early', 'missing', 'orphan-late'])
    expect(text).toContain('Status: anchored (lines 10-10)')
    expect(text).toContain('Status: anchored (lines 10-18)')
    expect(text).toContain('Status: anchored (lines 40-42)')
    expect(text).toContain('Status: ORPHANED (quote not found in file)')
    expect(text).not.toContain('lines 1-1')
    expect(text).toContain('> старая\n> цитата')
  })
})
