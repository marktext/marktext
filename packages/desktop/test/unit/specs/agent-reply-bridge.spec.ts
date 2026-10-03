import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Anchor } from '@shared/types/comments'
import type { AcpMcpServer } from 'main_renderer/agent/harness/acpConnection'
import { AcpConnection } from 'main_renderer/agent/harness/acpConnection'
import { bindCommentsService } from 'main_renderer/agent/comments/commentsService'
import { load } from 'main_renderer/agent/comments/commentsStore'
import { setWindowTurn, windowTurn } from 'main_renderer/agent/comments/windowTurn'
import { bridgeForWindow, closeBridgeServer, releaseWindowBridge } from 'main_renderer/agent/mcpBridge/bridgeServer'
import { marktextMcpServer } from 'main_renderer/agent/mcpBridge/marktextMcpServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'

const require = createRequire(import.meta.url)
const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const windowId = 11
const dirs: string[] = []
const connections: AcpConnection[] = []
const bridgeScript = path.join(process.cwd(), 'out/main/agentMcpBridge.js')

beforeAll(() => {
  if (fs.existsSync(bridgeScript)) return
  // Vitest's jsdom environment breaks esbuild, so the bundle is built in a plain Node process.
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { builtinModules } from 'node:module'
    import path from 'node:path'
    import { build } from 'vite'
    const nodeBuiltins = [...builtinModules, ...builtinModules.map((name) => 'node:' + name)]
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        ssr: true,
        outDir: ${JSON.stringify(path.dirname(bridgeScript))},
        emptyOutDir: false,
        minify: false,
        rollupOptions: {
          input: { agentMcpBridge: ${JSON.stringify(path.join(process.cwd(), 'src/main/agent/mcpBridge/bridgeEntry.ts'))} },
          external: ['electron', ...nodeBuiltins],
          output: { format: 'cjs', entryFileNames: 'agentMcpBridge.js', inlineDynamicImports: true }
        }
      },
      ssr: { noExternal: true }
    })
  `], { cwd: process.cwd(), stdio: 'inherit' })
})

afterEach(async() => {
  delete process.env.FAKE_ACP_MODE
  delete process.env.FAKE_ACP_SCENARIO
  delete process.env.FAKE_ACP_LOG
  delete process.env.FAKE_ACP_CWD
  delete process.env.FAKE_ACP_REPLY_THREAD
  delete process.env.FAKE_ACP_REPLY_TEXT
  setWindowTurn(windowId, null)
  releaseWindowBridge(windowId)
  repoRegistry.release(windowId)
  for (const connection of connections.splice(0)) await connection.dispose()
  await closeBridgeServer()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-reply-bridge-'))
  dirs.push(dir)
  return dir
}

const anchor = (): Anchor => ({
  quote: 'цитата',
  prefix: 'до ',
  suffix: ' после',
  blockHint: { type: 'paragraph', index: 0 }
})

const bridgeCommand = (): string => {
  try {
    const resolved = require('electron') as unknown
    if (typeof resolved === 'string' && fs.existsSync(resolved)) return resolved
  } catch {
    // The script is plain Node. process.execPath still receives ELECTRON_RUN_AS_NODE.
  }
  return process.execPath
}

const serverFor = (address: string, token: string): AcpMcpServer => ({
  ...marktextMcpServer(process.cwd(), address, token),
  command: bridgeCommand(),
  args: [bridgeScript]
})

const readLog = (logPath: string): { event?: string, result?: { isError?: boolean, content?: { text?: string }[] } }[] => {
  if (!fs.existsSync(logPath)) return []
  return fs.readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event?: string, result?: { isError?: boolean, content?: { text?: string }[] } })
}

const prepare = async(): Promise<{ root: string, threadId: string, logPath: string }> => {
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
    harness: 'opencode',
    model: 'claude'
  })
  const logPath = path.join(root, 'agent.log')
  process.env.FAKE_ACP_MODE = 'mcp-reply'
  process.env.FAKE_ACP_LOG = logPath
  process.env.FAKE_ACP_CWD = root
  return { root, threadId, logPath }
}

const promptReply = async(server: AcpMcpServer): Promise<void> => {
  const connection = await AcpConnection.start({
    command: process.execPath,
    args: [fixture],
    cwd: tempDir(),
    harness: 'opencode',
    quirks: { repliesVia: 'mcp', resume: 'auto', authMethodId: 'opencode-login' },
    onEvent: () => undefined
  })
  connections.push(connection)
  const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [server] })
  await connection.prompt(created.sessionId, 'review')
}

describe('reply bridge from out/', () => {
  it('stores the fake agent tool call with the session author and the same status', async() => {
    const { root, threadId, logPath } = await prepare()
    process.env.FAKE_ACP_REPLY_THREAD = threadId
    process.env.FAKE_ACP_REPLY_TEXT = 'исправлено'
    const userData = tempDir()
    const bridge = await bridgeForWindow(userData, windowId)
    const server = serverFor(bridge.address, bridge.token)
    expect(server.env).toContainEqual({ name: 'ELECTRON_RUN_AS_NODE', value: '1' })
    expect(server.args[0]).toBe(bridgeScript)

    await promptReply(server)

    const stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].status).toBe('closed')
    expect(stored.file.threads[0].messages[1]).toMatchObject({
      author: { kind: 'agent', harness: 'opencode', model: 'claude' },
      text: 'исправлено',
      turnId: 'turn-1'
    })
    expect(readLog(logPath).some((entry) => entry.event === 'mcp-reply' && entry.result?.isError !== true)).toBe(true)
  })

  it('rejects a foreign token and a thread outside the current turn', async() => {
    const { root, threadId, logPath } = await prepare()
    const userData = tempDir()
    const bridge = await bridgeForWindow(userData, windowId)

    process.env.FAKE_ACP_REPLY_THREAD = threadId
    process.env.FAKE_ACP_REPLY_TEXT = 'чужой'
    await promptReply(serverFor(bridge.address, 'f'.repeat(64)))
    let stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].messages).toHaveLength(1)
    expect(readLog(logPath).some((entry) => entry.result?.content?.some((part) => part.text === 'unknown token'))).toBe(true)

    process.env.FAKE_ACP_REPLY_THREAD = 'not-in-turn'
    process.env.FAKE_ACP_REPLY_TEXT = 'мимо'
    await promptReply(serverFor(bridge.address, bridge.token))
    stored = await load(root, 'a.md')
    if (stored.kind !== 'ok') throw new Error('expected comments')
    expect(stored.file.threads[0].messages).toHaveLength(1)
    expect(readLog(logPath).some((entry) =>
      entry.result?.content?.some((part) => part.text === 'thread is not part of the current turn')
    )).toBe(true)
  })
})
