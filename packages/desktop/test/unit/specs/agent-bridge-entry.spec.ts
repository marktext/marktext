import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { Anchor } from '@shared/types/comments'
import { bindCommentsService } from 'main_renderer/agent/comments/commentsService'
import { load } from 'main_renderer/agent/comments/commentsStore'
import { setWindowTurn, windowTurn } from 'main_renderer/agent/comments/windowTurn'
import { createReplyMcpServer } from 'main_renderer/agent/mcpBridge/bridgeEntry'
import { bridgeForWindow, closeBridgeServer, releaseWindowBridge } from 'main_renderer/agent/mcpBridge/bridgeServer'
import { agentMcpBridgeScript, marktextMcpServer } from 'main_renderer/agent/mcpBridge/marktextMcpServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'

const windowId = 8
const dirs: string[] = []
const clients: Client[] = []

afterEach(async() => {
  delete process.env.MARKTEXT_BRIDGE_ADDR
  delete process.env.MARKTEXT_BRIDGE_TOKEN
  setWindowTurn(windowId, null)
  releaseWindowBridge(windowId)
  repoRegistry.release(windowId)
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await closeBridgeServer()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-bridge-entry-'))
  dirs.push(dir)
  return dir
}

const anchor = (): Anchor => ({
  quote: 'цитата',
  prefix: 'до ',
  suffix: ' после',
  blockHint: { type: 'paragraph', index: 0 }
})

const connectClient = async(): Promise<Client> => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'marktext-test', version: '0.0.0' })
  await Promise.all([
    client.connect(clientTransport),
    createReplyMcpServer().connect(serverTransport)
  ])
  clients.push(client)
  return client
}

const toolText = (result: unknown): string => {
  if (!result || typeof result !== 'object' || !('content' in result)) return ''
  const content = result.content
  if (!Array.isArray(content) || content.length === 0) return ''
  const first = content[0] as { text?: unknown }
  return typeof first.text === 'string' ? first.text : ''
}

const isToolError = (result: unknown): boolean =>
  !!result && typeof result === 'object' && 'isError' in result && result.isError === true

describe('marktextMcpServer', () => {
  it('describes the stdio bridge for session/new and session/resume', () => {
    const server = marktextMcpServer('/apps/marktext', '/tmp/bridge.sock', 'abc')
    expect(server).toEqual({
      name: 'marktext',
      command: process.execPath,
      args: [path.join('/apps/marktext', 'out', 'main', 'agentMcpBridge.js')],
      env: [
        { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
        { name: 'MARKTEXT_BRIDGE_ADDR', value: '/tmp/bridge.sock' },
        { name: 'MARKTEXT_BRIDGE_TOKEN', value: 'abc' }
      ]
    })
    expect(agentMcpBridgeScript('/opt/MarkText/resources/app.asar')).toBe(
      path.join('/opt/MarkText/resources/app.asar.unpacked', 'out', 'main', 'agentMcpBridge.js')
    )
  })
})

describe('reply_to_thread tool', () => {
  it('advertises the reply tool and posts through the bridge', async() => {
    const root = tempDir()
    const userData = tempDir()
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
      harness: 'opencode',
      model: 'claude'
    })
    const bridge = await bridgeForWindow(userData, windowId)
    process.env.MARKTEXT_BRIDGE_ADDR = bridge.address
    process.env.MARKTEXT_BRIDGE_TOKEN = bridge.token

    const client = await connectClient()
    const listed = await client.listTools()
    expect(listed.tools).toEqual([
      expect.objectContaining({
        name: 'reply_to_thread',
        description: 'Post your answer to a MarkText comment thread. Call once per thread in the current request. Does not change thread status.'
      })
    ])
    const schema = listed.tools[0].inputSchema as {
      properties?: Record<string, { type?: string }>
    }
    expect(schema.properties?.threadId?.type).toBe('string')
    expect(schema.properties?.text?.type).toBe('string')

    const posted = await client.callTool({
      name: 'reply_to_thread',
      arguments: { threadId, text: 'исправлено' }
    })
    expect(isToolError(posted)).toBe(false)
    expect(toolText(posted)).toBe('Reply posted.')

    const stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].status).toBe('closed')
    expect(stored.file.threads[0].messages[1]).toMatchObject({
      author: { kind: 'agent', harness: 'opencode', model: 'claude' },
      text: 'исправлено',
      turnId: 'turn-1'
    })
  })

  it('returns a tool error when the bridge is missing or rejects the token', async() => {
    const client = await connectClient()
    const unconfigured = await client.callTool({
      name: 'reply_to_thread',
      arguments: { threadId: 't1', text: 'x' }
    })
    expect(isToolError(unconfigured)).toBe(true)
    expect(toolText(unconfigured)).toContain('MARKTEXT_BRIDGE_ADDR')

    process.env.MARKTEXT_BRIDGE_ADDR = path.join(tempDir(), 'missing.sock')
    process.env.MARKTEXT_BRIDGE_TOKEN = 'nope'
    const disconnected = await client.callTool({
      name: 'reply_to_thread',
      arguments: { threadId: 't1', text: 'x' }
    })
    expect(isToolError(disconnected)).toBe(true)
    expect(toolText(disconnected)).toContain('Could not connect to the MarkText bridge')

    const userData = tempDir()
    const bridge = await bridgeForWindow(userData, windowId)
    process.env.MARKTEXT_BRIDGE_ADDR = bridge.address
    process.env.MARKTEXT_BRIDGE_TOKEN = 'f'.repeat(64)
    const rejected = await client.callTool({
      name: 'reply_to_thread',
      arguments: { threadId: 't1', text: 'x' }
    })
    expect(isToolError(rejected)).toBe(true)
    expect(toolText(rejected)).toBe('unknown token')
  })
})
