import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Anchor } from '@shared/types/comments'
import { bindCommentsService } from 'main_renderer/agent/comments/commentsService'
import { load } from 'main_renderer/agent/comments/commentsStore'
import { setWindowTurn, windowTurn } from 'main_renderer/agent/comments/windowTurn'
import {
  bridgeForWindow,
  bridgeListenPath,
  closeBridgeServer,
  releaseWindowBridge
} from 'main_renderer/agent/mcpBridge/bridgeServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'

const windowId = 7
const dirs: string[] = []

afterEach(async() => {
  setWindowTurn(windowId, null)
  releaseWindowBridge(windowId)
  repoRegistry.release(windowId)
  await closeBridgeServer()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-bridge-'))
  dirs.push(dir)
  return dir
}

const anchor = (): Anchor => ({
  quote: 'цитата',
  prefix: 'до ',
  suffix: ' после',
  blockHint: { type: 'paragraph', index: 0 }
})

const bind = (root: string): ReturnType<typeof bindCommentsService> => {
  let tick = 0
  let id = 0
  return bindCommentsService({
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
}

const roundtrip = (address: string, body: unknown): Promise<{ ok: boolean, error?: string }> =>
  new Promise((resolve, reject) => {
    const socket = net.connect(address)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      socket.end()
      resolve(JSON.parse(buffer.slice(0, newline)) as { ok: boolean, error?: string })
    })
    socket.on('error', reject)
    socket.write(`${JSON.stringify(body)}\n`)
  })

describe('bridgeServer', () => {
  it('appends the reply for the current turn and keeps the thread status', async() => {
    const root = tempDir()
    const userData = tempDir()
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    const service = bind(root)
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

    const bridge = await bridgeForWindow(userData, windowId)
    const again = await bridgeForWindow(userData, windowId)
    expect(again).toEqual(bridge)
    expect(bridge.token).toMatch(/^[0-9a-f]{64}$/)
    expect(fs.readdirSync(path.join(userData, 'agent', 'run'))).toHaveLength(1)
    expect(fs.statSync(bridge.address).mode & 0o777).toBe(0o600)

    const response = await roundtrip(bridge.address, {
      token: bridge.token,
      method: 'reply_to_thread',
      params: { threadId, text: 'исправлено' }
    })
    expect(response).toEqual({ ok: true })

    const stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].status).toBe('closed')
    expect(stored.file.threads[0].messages[1]).toMatchObject({
      author: { kind: 'agent', harness: 'pi', model: 'model-a' },
      text: 'исправлено',
      turnId: 'turn-1'
    })
  })

  it('rejects an unknown token and a thread outside the current turn', async() => {
    const root = tempDir()
    const userData = tempDir()
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    bind(root)
    setWindowTurn(windowId, {
      turnId: 'turn-1',
      file: 'a.md',
      threadIds: ['in-turn'],
      harness: 'opencode',
      model: 'm'
    })
    const bridge = await bridgeForWindow(userData, windowId)

    const unknown = await roundtrip(bridge.address, {
      token: 'f'.repeat(64),
      method: 'reply_to_thread',
      params: { threadId: 'in-turn', text: 'nope' }
    })
    expect(unknown).toEqual({ ok: false, error: 'unknown token' })

    const outside = await roundtrip(bridge.address, {
      token: bridge.token,
      method: 'reply_to_thread',
      params: { threadId: 'other', text: 'nope' }
    })
    expect(outside).toEqual({ ok: false, error: 'thread is not part of the current turn' })

    releaseWindowBridge(windowId)
    const released = await roundtrip(bridge.address, {
      token: bridge.token,
      method: 'reply_to_thread',
      params: { threadId: 'in-turn', text: 'nope' }
    })
    expect(released).toEqual({ ok: false, error: 'unknown token' })
  })

  it('names a Windows pipe and a Unix socket under userData', () => {
    expect(bridgeListenPath('/data', 'abc', 'win32')).toBe('\\\\.\\pipe\\marktext-agent-abc')
    expect(bridgeListenPath('/data', 'abc', 'linux')).toBe(path.join('/data', 'agent', 'run', 'abc.sock'))
  })
})
