import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { REPLY_MAX_CHARS, type Anchor } from '@shared/types/comments'
import { CommentsService, CommentsServiceError } from 'main_renderer/agent/comments/commentsService'
import { load, markdownPathFromStoreFile, pathFor } from 'main_renderer/agent/comments/commentsStore'
import { isOwnCommentsWrite } from 'main_renderer/agent/comments/commentsWriteMark'
import type { WindowTurn } from 'main_renderer/agent/comments/windowTurn'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-comments-svc-'))
  dirs.push(dir)
  return dir
}

const anchor = (quote = 'цитата'): Anchor => ({
  quote,
  prefix: 'до ',
  suffix: ' после',
  blockHint: { type: 'paragraph', index: 0 }
})

const harness = (): {
  service: CommentsService
  root: string
  changed: string[]
  setTurn: (turn: WindowTurn | null) => void
} => {
  const root = tempDir()
  const changed: string[] = []
  let tick = 0
  let id = 0
  let turn: WindowTurn | null = null
  const service = new CommentsService({
    now: () => {
      tick += 1
      return `2026-10-02T12:00:${String(tick).padStart(2, '0')}.000Z`
    },
    newId: () => {
      id += 1
      return `id-${id}`
    },
    userName: async() => 'Ada',
    turnOf: () => turn,
    repoOf: () => root,
    onChanged: (_root, file) => {
      changed.push(file)
    }
  })
  return { service, root, changed, setTurn: (next) => { turn = next } }
}

describe('commentsService', () => {
  it('creates, extends, edits, closes, reopens and deletes a thread', async() => {
    const { service, root, changed } = harness()
    const created = await service.apply(1, root, {
      op: 'createThread',
      file: 'docs/guide.md',
      anchor: anchor(),
      firstText: 'первая'
    })
    expect(created.threads).toHaveLength(1)
    expect(created.threads[0].messages[0]).toMatchObject({
      text: 'первая',
      author: { kind: 'human', name: 'Ada' },
      editedAt: null
    })
    expect(changed).toEqual(['docs/guide.md'])
    expect(isOwnCommentsWrite(pathFor(root, 'docs/guide.md'))).toBe(true)

    const threadId = created.threads[0].id
    const added = await service.apply(1, root, { op: 'addHumanMessage', threadId, text: 'вторая' })
    const humanIds = added.threads[0].messages.map((message) => message.id)
    const edited = await service.apply(1, root, {
      op: 'editHumanMessage',
      messageId: humanIds[1],
      text: 'исправлено'
    })
    expect(edited.threads[0].messages[1]).toMatchObject({ text: 'исправлено', editedAt: expect.any(String) })

    const removed = await service.apply(1, root, { op: 'deleteHumanMessage', messageId: humanIds[1] })
    expect(removed.threads[0].messages).toHaveLength(1)

    const closed = await service.apply(1, root, { op: 'setStatus', threadId, status: 'closed' })
    expect(closed.threads[0]).toMatchObject({ status: 'closed', closedAt: expect.any(String) })
    const reopened = await service.apply(1, root, { op: 'setStatus', threadId, status: 'open' })
    expect(reopened.threads[0]).toMatchObject({ status: 'open', closedAt: null })

    const empty = await service.apply(1, root, { op: 'deleteThread', threadId })
    expect(empty.threads).toEqual([])
    expect(fs.existsSync(pathFor(root, 'docs/guide.md'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.marktext/comments/docs'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.marktext/comments'))).toBe(true)
  })

  it('rejects an empty quote, agent edits, and deleting the last human reply', async() => {
    const { service, root, setTurn } = harness()
    await expect(service.apply(1, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor('   '),
      firstText: 'x'
    })).rejects.toMatchObject({ code: 'empty_quote' })
    expect(fs.existsSync(path.join(root, '.marktext'))).toBe(false)

    const created = await service.apply(1, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'human'
    })
    const threadId = created.threads[0].id
    const humanId = created.threads[0].messages[0].id
    await expect(service.apply(1, root, { op: 'deleteHumanMessage', messageId: humanId })).rejects.toMatchObject({
      code: 'last_human_message'
    })

    setTurn({ turnId: 'turn-1', file: 'a.md', threadIds: [threadId], harness: 'opencode', model: 'm' })
    const replied = await service.apply(1, root, {
      op: 'appendAgentReply',
      turnId: 'turn-1',
      threadId,
      text: 'agent'
    })
    const agentId = replied.threads[0].messages.find((message) => message.author.kind === 'agent')?.id
    if (!agentId) throw new Error('expected an agent reply')
    await expect(service.apply(1, root, { op: 'editHumanMessage', messageId: agentId, text: 'nope' })).rejects.toMatchObject({
      code: 'not_human'
    })
    await expect(service.apply(1, root, { op: 'deleteHumanMessage', messageId: agentId })).rejects.toMatchObject({
      code: 'not_human'
    })
    const stored = await load(root, 'a.md')
    expect(stored.kind === 'ok' && stored.file.threads[0].messages.map((message) => message.text)).toEqual(['human', 'agent'])
  })

  it('appends an agent reply only for the current turn and leaves the status alone', async() => {
    const { service, root, setTurn } = harness()
    const created = await service.apply(1, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'human'
    })
    const threadId = created.threads[0].id
    await service.apply(1, root, { op: 'setStatus', threadId, status: 'closed' })
    const closedAt = (await load(root, 'a.md'))
    if (closedAt.kind !== 'ok') throw new Error('expected comments')
    const stamp = closedAt.file.threads[0].closedAt

    await expect(service.apply(1, root, {
      op: 'appendAgentReply',
      turnId: 'turn-1',
      threadId,
      text: 'no turn'
    })).rejects.toMatchObject({ code: 'turn_thread' })

    setTurn({ turnId: 'turn-1', file: 'a.md', threadIds: ['other'], harness: 'pi', model: 'model-a' })
    await expect(service.apply(1, root, {
      op: 'appendAgentReply',
      turnId: 'turn-1',
      threadId,
      text: 'wrong thread'
    })).rejects.toMatchObject({ code: 'turn_thread' })

    setTurn({ turnId: 'turn-1', file: 'a.md', threadIds: [threadId], harness: 'pi', model: 'model-a' })
    const replied = await service.apply(1, root, {
      op: 'appendAgentReply',
      turnId: 'turn-1',
      threadId,
      text: `${'я'.repeat(REPLY_MAX_CHARS)}лишнее`
    })
    const agent = replied.threads[0].messages[1]
    expect(agent.author).toEqual({ kind: 'agent', harness: 'pi', model: 'model-a' })
    if (agent.author.kind === 'agent') expect(agent.text).toHaveLength(REPLY_MAX_CHARS)
    expect(replied.threads[0]).toMatchObject({ status: 'closed', closedAt: stamp })
  })

  it('does not drop either of two overlapping writes to the same file', async() => {
    const { service, root } = harness()
    const created = await service.apply(1, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'base'
    })
    const threadId = created.threads[0].id
    await Promise.all([
      service.apply(1, root, { op: 'addHumanMessage', threadId, text: 'one' }),
      service.apply(1, root, { op: 'addHumanMessage', threadId, text: 'two' })
    ])
    const stored = await load(root, 'a.md')
    expect(stored.kind === 'ok' && stored.file.threads[0].messages.map((message) => message.text).sort()).toEqual([
      'base',
      'one',
      'two'
    ])
  })

  it('refuses to write over a conflicted file', async() => {
    const { service, root } = harness()
    const filePath = pathFor(root, 'a.md')
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const broken = '<<<<<<< HEAD\n{}\n'
    fs.writeFileSync(filePath, broken)
    await expect(service.apply(1, root, {
      op: 'createThread',
      file: 'a.md',
      anchor: anchor(),
      firstText: 'x'
    })).rejects.toMatchObject({ code: 'comments_write_blocked' })
    expect(fs.readFileSync(filePath, 'utf8')).toBe(broken)
  })

  it('moves the JSON, updates file, and skips a non-markdown path', async() => {
    const { service, root, changed } = harness()
    await service.apply(1, root, {
      op: 'createThread',
      file: 'docs/a.md',
      anchor: anchor(),
      firstText: 'keep'
    })
    changed.length = 0
    const moved = await service.apply(1, root, { op: 'moveFile', oldPath: 'docs/a.md', newPath: 'notes/b.md' })
    expect(moved.file).toBe('notes/b.md')
    expect(moved.threads[0].messages[0].text).toBe('keep')
    expect(fs.existsSync(pathFor(root, 'docs/a.md'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.marktext/comments/docs'))).toBe(false)
    expect(JSON.parse(fs.readFileSync(pathFor(root, 'notes/b.md'), 'utf8')).file).toBe('notes/b.md')
    expect(changed).toEqual(['notes/b.md', 'docs/a.md'])

    await expect(service.apply(1, root, { op: 'moveFile', oldPath: 'pic.png', newPath: 'other.png' })).rejects.toMatchObject({
      code: 'not_markdown'
    })
    expect(fs.existsSync(pathFor(root, 'notes/b.md'))).toBe(true)
  })

  it('reads a comments path back from the JSON file location', () => {
    const root = tempDir()
    const stored = pathFor(root, 'docs/guide.md')
    expect(markdownPathFromStoreFile(stored)).toBe('docs/guide.md')
    expect(markdownPathFromStoreFile(stored.replace(/\//g, '\\'))).toBe('docs/guide.md')
    expect(markdownPathFromStoreFile(path.join(root, 'docs/guide.md'))).toBeNull()
  })
})

describe('commentsService errors', () => {
  it('uses CommentsServiceError for a missing thread', async() => {
    const { service, root } = harness()
    await expect(service.apply(1, root, { op: 'addHumanMessage', threadId: 'missing', text: 'x' })).rejects.toBeInstanceOf(CommentsServiceError)
  })
})
