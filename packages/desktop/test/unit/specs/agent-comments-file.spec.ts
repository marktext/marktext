import { describe, expect, it } from 'vitest'
import { isCommentsFile, serializeCommentsFile, type CommentsFile } from '@shared/types/comments'

const unsorted: CommentsFile = {
  file: 'docs/guide.md',
  version: 1,
  threads: [
    {
      createdAt: '2026-10-02T12:00:00.000Z',
      id: 'thread-later',
      status: 'open',
      closedAt: null,
      messages: [
        {
          createdAt: '2026-10-02T12:03:10.000Z',
          id: 'msg-agent',
          text: 'Исправил формулировку.',
          turnId: 'turn-1',
          author: { model: 'anthropic/claude-sonnet-4-5', harness: 'opencode', kind: 'agent' }
        },
        {
          editedAt: null,
          createdAt: '2026-10-02T12:00:05.000Z',
          id: 'msg-human',
          text: 'Тут неточность.',
          author: { name: 'Evgeniy', kind: 'human' }
        }
      ],
      anchor: {
        suffix: ' и ESLint.',
        quote: 'строгий режим TypeScript',
        prefix: 'Проект использует ',
        blockHint: { index: 14, type: 'paragraph' }
      }
    },
    {
      id: 'thread-earlier',
      status: 'closed',
      createdAt: '2026-10-02T11:00:00.000Z',
      closedAt: '2026-10-02T11:30:00.000Z',
      anchor: {
        quote: 'earlier',
        prefix: '',
        suffix: '',
        blockHint: { type: 'heading', index: 0 }
      },
      messages: [
        {
          id: 'msg-early',
          author: { kind: 'human', name: 'me' },
          text: 'first',
          createdAt: '2026-10-02T11:00:01.000Z',
          editedAt: '2026-10-02T11:05:00.000Z'
        }
      ]
    }
  ]
}

describe('serializeCommentsFile', () => {
  it('keeps the same bytes after a parse', () => {
    const text = serializeCommentsFile(unsorted)
    const parsed: unknown = JSON.parse(text)
    expect(isCommentsFile(parsed)).toBe(true)
    if (!isCommentsFile(parsed)) return
    expect(serializeCommentsFile(parsed)).toBe(text)
  })

  it('sorts threads and messages by createdAt and fixes key order', () => {
    const text = serializeCommentsFile(unsorted)
    expect(text.endsWith('\n')).toBe(true)
    expect(text.startsWith('{\n  "version": 1,\n  "file": "docs/guide.md"')).toBe(true)
    const parsed: unknown = JSON.parse(text)
    if (!isCommentsFile(parsed)) throw new Error('serialized file did not validate')
    expect(parsed.threads.map((thread) => thread.id)).toEqual(['thread-earlier', 'thread-later'])
    expect(parsed.threads[1]?.messages.map((message) => message.id)).toEqual([
      'msg-human',
      'msg-agent'
    ])
    const agent = parsed.threads[1]?.messages[1]
    expect(agent && 'turnId' in agent ? agent.turnId : null).toBe('turn-1')
  })

  it('rejects an unknown thread status', () => {
    const parsed: unknown = JSON.parse(serializeCommentsFile(unsorted))
    if (!isCommentsFile(parsed)) throw new Error('fixture did not validate')
    const broken = {
      ...parsed,
      threads: parsed.threads.map((thread, index) =>
        index === 0 ? { ...thread, status: 'archived' } : thread
      )
    }
    expect(isCommentsFile(broken)).toBe(false)
  })

  it('rejects an agent message without turnId', () => {
    const parsed: unknown = JSON.parse(serializeCommentsFile(unsorted))
    if (typeof parsed !== 'object' || parsed === null || !('threads' in parsed)) {
      throw new Error('fixture did not parse')
    }
    const threads = parsed.threads
    if (!Array.isArray(threads)) throw new Error('missing threads')
    const later: unknown = threads[1]
    if (typeof later !== 'object' || later === null || !('messages' in later)) {
      throw new Error('missing thread')
    }
    const messages = later.messages
    if (!Array.isArray(messages)) throw new Error('missing messages')
    const agent: unknown = messages[1]
    if (typeof agent !== 'object' || agent === null || !('turnId' in agent)) {
      throw new Error('missing agent message')
    }
    delete agent.turnId
    expect(isCommentsFile(parsed)).toBe(false)
  })
})
