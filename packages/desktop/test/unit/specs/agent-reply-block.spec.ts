import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Anchor } from '@shared/types/comments'
import { bindCommentsService } from 'main_renderer/agent/comments/commentsService'
import { load } from 'main_renderer/agent/comments/commentsStore'
import { setWindowTurn, windowTurn } from 'main_renderer/agent/comments/windowTurn'
import { applyBlockReplies, parseReplyBlock } from 'main_renderer/agent/harness/replyBlockParser'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'

const windowId = 9
const dirs: string[] = []

afterEach(() => {
  setWindowTurn(windowId, null)
  repoRegistry.release(windowId)
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-reply-block-'))
  dirs.push(dir)
  return dir
}

const anchor = (): Anchor => ({
  quote: 'цитата',
  prefix: 'до ',
  suffix: ' после',
  blockHint: { type: 'paragraph', index: 0 }
})

const fence = (body: string): string => `\`\`\`marktext-replies\n${body}\n\`\`\``

describe('parseReplyBlock', () => {
  it('uses the last marktext-replies fence and leaves every earlier one', () => {
    const text = [
      'first try',
      fence('[{"threadId":"old","text":"no"}]'),
      'done',
      fence('[{"threadId":"new","text":"yes"}]')
    ].join('\n')

    expect(parseReplyBlock(text)).toEqual({
      kind: 'replies',
      replies: [{ threadId: 'new', text: 'yes' }]
    })
    expect(text).toContain('old')
  })

  it('reports an unreadable block instead of an earlier valid one', () => {
    const text = [
      fence('[{"threadId":"old","text":"kept out"}]'),
      fence('{')
    ].join('\n')

    expect(parseReplyBlock(text)).toEqual({
      kind: 'invalid',
      message: 'The marktext-replies block is not valid JSON. No replies were saved.'
    })
  })
})

describe('applyBlockReplies', () => {
  it('writes each reply and leaves the thread status unchanged', async() => {
    const root = tempDir()
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    let tick = 0
    let id = 0
    const service = bindCommentsService({
      now: () => {
        tick += 1
        return `2026-10-02T12:00:${String(tick).padStart(2, '0')}.000Z`
      },
      newId: () => {
        id += 1
        return `id-${id}`
      },
      userName: async() => 'Ada',
      turnOf: windowTurn,
      repoOf: () => root,
      onChanged: () => undefined
    })
    const created = await service.apply(windowId, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'human'
    })
    const threadId = created.threads[0].id
    await service.apply(windowId, root, { op: 'setStatus', threadId, status: 'closed' })
    setWindowTurn(windowId, {
      turnId: 'turn-1',
      file: 'a.md',
      threadIds: [threadId],
      harness: 'pi',
      model: 'model-a'
    })
    const agentText = `Done.\n${fence(JSON.stringify([{ threadId, text: 'исправлено' }]))}`

    const warning = await applyBlockReplies({
      repliesVia: 'block',
      windowId,
      root,
      turnId: 'turn-1',
      agentText
    })

    expect(warning).toBeNull()
    expect(agentText).toContain('marktext-replies')
    const stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].status).toBe('closed')
    expect(stored.file.threads[0].messages[1]).toMatchObject({
      author: { kind: 'agent', harness: 'pi', model: 'model-a' },
      text: 'исправлено',
      turnId: 'turn-1'
    })
  })

  it('emits a chat warning and writes nothing when the block is invalid', async() => {
    const root = tempDir()
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    let id = 0
    const service = bindCommentsService({
      now: () => '2026-10-02T12:00:01.000Z',
      newId: () => {
        id += 1
        return `id-${id}`
      },
      userName: async() => 'Ada',
      turnOf: windowTurn,
      repoOf: () => root,
      onChanged: () => undefined
    })
    const created = await service.apply(windowId, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'human'
    })
    setWindowTurn(windowId, {
      turnId: 'turn-1',
      file: 'a.md',
      threadIds: [created.threads[0].id],
      harness: 'pi',
      model: 'model-a'
    })

    const warning = await applyBlockReplies({
      repliesVia: 'block',
      windowId,
      root,
      turnId: 'turn-1',
      agentText: fence('not-json')
    })

    expect(warning).toEqual({
      type: 'error',
      message: 'The marktext-replies block is not valid JSON. No replies were saved.'
    })
    const stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].messages).toHaveLength(1)
  })

  it('does not read the block when replies arrive through the tool', async() => {
    const root = tempDir()
    const warning = await applyBlockReplies({
      repliesVia: 'mcp',
      windowId,
      root,
      turnId: 'turn-1',
      agentText: fence('[{"threadId":"t","text":"x"}]')
    })
    expect(warning).toBeNull()
    expect(fs.existsSync(path.join(root, '.marktext'))).toBe(false)
  })
})
