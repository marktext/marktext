import { describe, it, expect } from 'vitest'
import type { ChatEvent } from '@shared/types/agent'
import { commentsCard, groupTurns, splitRepliesFence } from '@/agent/chatTranscript'
import { renderChatMarkdown } from '@/agent/chatMarkdown'

const user = (text: string, messageId = 'u1'): ChatEvent => ({
  type: 'message_chunk',
  role: 'user',
  messageId,
  text
})

describe('chat transcript', () => {
  it('keeps one turn around the user text, the answer, and a merged tool row', () => {
    const turns = groupTurns([
      { type: 'turn_started', turnId: 'turn-1' },
      user('Where is the lockfile?'),
      { type: 'thought_chunk', messageId: 'th', text: 'looking' },
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Read guide',
        status: 'in_progress',
        locations: ['guide.md']
      },
      {
        type: 'tool_call_update',
        toolCallId: 'tool-1',
        title: 'Read guide',
        status: 'completed',
        locations: ['guide.md'],
        diffPaths: []
      },
      { type: 'message_chunk', role: 'agent', messageId: 'a1', text: 'In the root.' },
      {
        type: 'turn_finished',
        turnId: 'turn-1',
        stopReason: 'end_turn',
        changedPaths: [],
        missingReplyThreadIds: []
      }
    ])
    expect(turns).toHaveLength(1)
    expect(turns[0]?.userText).toBe('Where is the lockfile?')
    expect(turns[0]?.body.map((item) => item.type)).toEqual(['thought', 'tool', 'agent'])
    expect(turns[0]?.body[1]).toMatchObject({ status: 'completed', locations: ['guide.md'] })
    expect(turns[0]?.finished?.stopReason).toBe('end_turn')
  })

  it('joins token-sized reasoning into one block and a token-sized answer into one message', () => {
    const turns = groupTurns([
      user('Review this'),
      { type: 'thought_chunk', messageId: 't1', text: 'Фор' },
      { type: 'thought_chunk', messageId: 't2', text: 'мули' },
      { type: 'thought_chunk', messageId: 't3', text: 'ровка' },
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Read',
        status: 'completed',
        locations: []
      },
      { type: 'thought_chunk', messageId: 't4', text: 'Дальше' },
      { type: 'message_chunk', role: 'agent', messageId: 'a1', text: 'сред' },
      { type: 'message_chunk', role: 'agent', messageId: 'a2', text: ' разработки' },
      { type: 'message_chunk', role: 'agent', messageId: 'a3', text: '.' }
    ])
    expect(turns).toHaveLength(1)
    const body = turns[0]?.body ?? []
    expect(body.map((item) => item.type)).toEqual(['thought', 'tool', 'agent'])
    expect(body[0]).toMatchObject({ type: 'thought', text: 'Формулировка\n\nДальше' })
    expect(body[2]).toMatchObject({ type: 'agent', text: 'сред разработки.' })
  })

  it('recognizes a comments send and hides the replies fence from the prose', () => {
    const text = 'Rules:\n\nFile: docs/guide.md\n\n### Thread t-1\nQuote:\n> strict\n'
    expect(commentsCard(text)).toEqual({ file: 'docs/guide.md', count: 1 })
    expect(commentsCard('hello')).toBeNull()
    const split = splitRepliesFence('Done.\n```marktext-replies\n[{"threadId":"t-1"}]\n```')
    expect(split.prose).toBe('Done.')
    expect(split.fences).toEqual(['[{"threadId":"t-1"}]'])
  })

  it('escapes markdown before adding tags', () => {
    expect(renderChatMarkdown('Use `a < b`\n\n- one')).toBe(
      '<p>Use <code>a &lt; b</code></p><ul><li>one</li></ul>'
    )
  })

  it('keeps a failed turn and starts the next send after it', () => {
    const turns = groupTurns([
      user('first', 'u1'),
      { type: 'error', message: 'agent exited 1' },
      {
        type: 'turn_finished',
        turnId: 'turn-1',
        stopReason: 'error',
        changedPaths: [],
        missingReplyThreadIds: []
      },
      user('first', 'u2')
    ])
    expect(turns).toHaveLength(2)
    expect(turns[0]?.error).toBe('agent exited 1')
    expect(turns[0]?.finished?.stopReason).toBe('error')
    expect(turns[1]?.userText).toBe('first')
  })
})
