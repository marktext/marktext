import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setWindowTurn } from 'main_renderer/agent/comments/windowTurn'
import { forgetCachedModels } from 'main_renderer/agent/harness/modelProbe'
import { registerAgentIpc } from 'main_renderer/agent/index'
import { closeBridgeServer } from 'main_renderer/agent/mcpBridge/bridgeServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'
import { detachChangeTracker } from 'main_renderer/agent/turn/changeTracker'
import { clearWindowAgentHost } from 'main_renderer/agent/windowAgentHost'

const ipc = vi.hoisted(() => {
  const handles = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const sent: unknown[][] = []
  return { handles, listeners, sent }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      ipc.handles.set(channel, listener)
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const list = ipc.listeners.get(channel) ?? []
      list.push(listener)
      ipc.listeners.set(channel, list)
    }
  },
  BrowserWindow: {
    fromWebContents: () => ({
      id: 41,
      isDestroyed: () => false,
      webContents: {
        send: (...args: unknown[]) => {
          ipc.sent.push(args)
        }
      }
    }),
    fromId: () => ({
      id: 41,
      isDestroyed: () => false,
      webContents: {
        send: (...args: unknown[]) => {
          ipc.sent.push(args)
        }
      }
    }),
    getAllWindows: () => []
  }
}))

vi.mock('electron-log', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const windowId = 41
const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const dirs: string[] = []
let userData = ''
let root = ''
let mode = true
const paths: Record<string, string> = {}

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  const handler = ipc.handles.get(channel)
  if (!handler) return Promise.reject(new Error(`missing ${channel}`))
  try {
    return Promise.resolve(handler({ sender: {} }, ...args))
  } catch (error) {
    return Promise.reject(error)
  }
}

const emitPrefs = (change: object): void => {
  for (const listener of ipc.listeners.get('broadcast-preferences-changed') ?? []) {
    listener(change)
  }
}

const childCommands = (): { pid: number, command: string }[] => {
  const output = process.platform === 'win32'
    ? execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid}" | ForEach-Object { '{0} {1}' -f $_.ProcessId, $_.CommandLine }`
    ], { encoding: 'utf8' })
    : execFileSync('ps', ['-o', 'pid=,command=', '--ppid', String(process.pid)], { encoding: 'utf8' })
  const found: { pid: number, command: string }[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line)
    const pidText = match?.[1]
    const command = match?.[2]
    if (!pidText || !command) continue
    found.push({ pid: Number(pidText), command })
  }
  return found
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

beforeAll(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-pref-data-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-pref-repo-'))
  dirs.push(userData, root)
  paths.agentOpencodePath = path.join(root, 'missing-opencode')
  paths.agentPiPath = path.join(root, 'missing-pi')
  paths.agentCursorPath = path.join(root, 'missing-cursor')
  paths.agentTerminalShell = ''
  delete process.env.FAKE_ACP_SCENARIO
  process.env.FAKE_ACP_MODE = 'happy'
  registerAgentIpc({
    harnessPath: (key) => key === 'agentModeEnabled' ? mode : (paths[key] ?? ''),
    userDataPath: userData,
    appPath: process.cwd()
  })
})

beforeEach(() => {
  mode = true
})

afterEach(async() => {
  mode = false
  emitPrefs({ agentModeEnabled: false })
  const started = Date.now()
  while (childCommands().some((child) => child.command.includes('agent.mjs'))) {
    if (Date.now() - started > 3000) break
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  repoRegistry.release(windowId)
  detachChangeTracker(windowId)
  setWindowTurn(windowId, null)
  clearWindowAgentHost(windowId)
  await closeBridgeServer()
})

afterAll(() => {
  delete process.env.FAKE_ACP_MODE
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

describe('agent preference keys', () => {
  it('stores the mode, harness paths, and terminal shell', () => {
    const schema = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'src/main/preferences/schema.json'),
      'utf8'
    )) as Record<string, { type?: string, default?: unknown }>
    const defaults = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'static/preference.json'),
      'utf8'
    )) as Record<string, unknown>

    expect(schema.agentModeEnabled).toMatchObject({ type: 'boolean', default: true })
    expect(schema.agentTerminalShell).toMatchObject({ type: 'string', default: '' })
    expect(schema.agentPiPath).toMatchObject({ type: 'string', default: '' })
    expect(defaults.agentModeEnabled).toBe(true)
    expect(defaults.agentTerminalShell).toBe('')
    expect(defaults.agentOpencodePath).toBe('')
    expect(defaults.agentCursorPath).toBe('')
  })

  it('drops only the changed harness from the model cache', () => {
    const cacheFile = path.join(userData, 'agent', 'model-cache.json')
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, `${JSON.stringify({
      pi: { fetchedAt: 't', models: [{ id: 'alpha', label: 'Alpha' }] },
      opencode: { fetchedAt: 't', models: [{ id: 'beta', label: 'Beta' }] }
    }, null, 2)}\n`)

    paths.agentPiPath = path.join(root, 'other-pi')
    emitPrefs({ agentPiPath: paths.agentPiPath, theme: 'dark' })

    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as {
      pi?: unknown
      opencode?: { models: { id: string }[] }
    }
    expect(stored.pi).toBeUndefined()
    expect(stored.opencode?.models[0]?.id).toBe('beta')
    forgetCachedModels(cacheFile, ['opencode'])
    const cleared = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { opencode?: unknown }
    expect(cleared.opencode).toBeUndefined()
  })
})

describe('agent mode off', () => {
  const channels: [string, ...unknown[]][] = [
    ['mt::agent::answer-permission', 'req', 'allow-once'],
    ['mt::agent::cancel-turn'],
    ['mt::agent::get-harness-status'],
    ['mt::agent::get-repo-state'],
    ['mt::agent::get-selection'],
    ['mt::agent::list-models', 'pi', {}],
    ['mt::agent::list-sessions', 'pi'],
    ['mt::agent::open-session', 'pi', 'new'],
    ['mt::agent::send-message', 'hi'],
    ['mt::agent::send-threads', 'docs/guide.md', [], []],
    ['mt::agent::set-selection', 'pi', 'alpha'],
    ['mt::git::diff', {}],
    ['mt::term::create', { cols: 80, rows: 24 }],
    ['mt::term::kill', 'term-1']
  ]

  it('rejects agent, terminal, and git handlers', async() => {
    mode = false
    for (const [channel, ...args] of channels) {
      await expect(invoke(channel, ...args)).rejects.toMatchObject({ code: 'agent_mode_disabled' })
    }
    const input = ipc.listeners.get('mt::term::input') ?? []
    const resize = ipc.listeners.get('mt::term::resize') ?? []
    expect(input.length).toBeGreaterThan(0)
    expect(resize.length).toBeGreaterThan(0)
    for (const listener of input) listener({ sender: {} }, 'term-1', 'ls\n')
    for (const listener of resize) listener({ sender: {} }, 'term-1', 80, 24)
  })

  it('stops the harness and the pty when the mode is turned off', async() => {
    const script = path.join(root, 'fake-harness')
    fs.writeFileSync(
      script,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`,
      { mode: 0o755 }
    )
    fs.chmodSync(script, 0o755)
    paths.agentPiPath = script
    execFileSync('git', ['init', '-q'], { cwd: root })
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    ipc.sent.length = 0

    await invoke('mt::agent::set-selection', 'pi', 'alpha')
    await invoke('mt::agent::send-message', 'hi')
    const harness = childCommands().find((child) => child.command.includes('agent.mjs'))
    if (!harness) throw new Error('harness did not start')
    const created = await invoke('mt::term::create', { cols: 80, rows: 24 })
    if (!created || typeof created !== 'object' || !('termId' in created) || typeof created.termId !== 'string') {
      throw new Error('term was not created')
    }

    mode = false
    emitPrefs({ agentModeEnabled: false })
    const started = Date.now()
    while (alive(harness.pid) || !ipc.sent.some((args) => args[0] === 'mt::term::exit' && args[1] === created.termId)) {
      if (Date.now() - started > 5000) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    expect(alive(harness.pid)).toBe(false)
    expect(ipc.sent.some((args) => args[0] === 'mt::term::exit' && args[1] === created.termId)).toBe(true)
    await expect(invoke('mt::git::diff', {})).rejects.toMatchObject({ code: 'agent_mode_disabled' })
  })
})
