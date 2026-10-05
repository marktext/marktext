import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { HISTORY_REPLAY_MAX_CHARS } from '@shared/types/agent'
import type { ChatEvent } from '@shared/types/agent'
import { closeBridgeServer } from 'main_renderer/agent/mcpBridge/bridgeServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'
import { SessionStore } from 'main_renderer/agent/sessions/sessionStore'
import { detachChangeTracker } from 'main_renderer/agent/turn/changeTracker'
import { HISTORY_REPLAY_LABEL } from 'main_renderer/agent/turn/historyReplay'
import { TurnRunner } from 'main_renderer/agent/turn/turnRunner'
import type { TurnRunnerDeps } from 'main_renderer/agent/turn/turnRunner'
import { clearWindowAgentHost } from 'main_renderer/agent/windowAgentHost'

const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const windowId = 32
const dirs: string[] = []
const runners: TurnRunner[] = []

afterEach(async() => {
  for (const runner of runners.splice(0)) await runner.disposeHarness()
  await closeBridgeServer()
  detachChangeTracker(windowId)
  clearWindowAgentHost(windowId)
  repoRegistry.release(windowId)
  for (const key of ['FAKE_ACP_MODE', 'FAKE_ACP_SCENARIO', 'FAKE_ACP_CWD', 'FAKE_ACP_LOG']) delete process.env[key]
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-session-'))
  dirs.push(dir)
  return dir
}

const git = (cwd: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })

const harnessScript = (root: string): string => {
  const script = path.join(root, 'fake-harness')
  const body = `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`
  fs.writeFileSync(script, body, { mode: 0o755 })
  fs.chmodSync(script, 0o755)
  return script
}

interface Inbound {
  method?: string | null
  params?: {
    prompt?: { text?: string }[]
    value?: string
    sessionId?: string
  }
}

const inbound = (logPath: string): Inbound[] => {
  if (!fs.existsSync(logPath)) return []
  return fs.readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Inbound)
}

const prompts = (logPath: string): string[] =>
  inbound(logPath)
    .filter((entry) => entry.method === 'session/prompt')
    .map((entry) => entry.params?.prompt?.[0]?.text ?? '')

const configValues = (logPath: string): string[] =>
  inbound(logPath)
    .filter((entry) => entry.method === 'session/set_config_option')
    .map((entry) => entry.params?.value ?? '')

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

interface Boot {
  runner: TurnRunner
  root: string
  userData: string
  script: string
  logPath: string
  events: ChatEvent[]
  store: SessionStore
  paths: 'pi' | 'both'
}

const boot = async(paths: 'pi' | 'both' = 'pi'): Promise<Boot> => {
  const root = tempDir()
  const userData = tempDir()
  const script = harnessScript(root)
  const logPath = path.join(userData, 'agent.log')
  await git(root, ['init', '-q'])
  await git(root, ['config', 'user.email', 'tester@example.com'])
  await git(root, ['config', 'user.name', 'Tester'])
  fs.writeFileSync(path.join(root, 'README.md'), 'hello\n')
  await git(root, ['add', '--', 'README.md'])
  await git(root, ['commit', '-qm', 'init'])
  process.env.FAKE_ACP_CWD = root
  process.env.FAKE_ACP_LOG = logPath
  const events: ChatEvent[] = []
  const runner = makeRunner(userData, script, paths, events)
  repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
  return {
    runner,
    root,
    userData,
    script,
    logPath,
    events,
    store: new SessionStore(path.join(userData, 'agent')),
    paths
  }
}

const makeRunner = (
  userData: string,
  script: string,
  paths: 'pi' | 'both',
  events: ChatEvent[]
): TurnRunner => {
  let tick = 0
  const deps: TurnRunnerDeps = {
    modeEnabled: () => true,
    preference: (key) => {
      if (key === 'agentHarness') return 'pi'
      if (key === 'agentPiPath') return script
      if (paths === 'both' && key === 'agentCursorPath') return script
      return ''
    },
    userDataPath: userData,
    appPath: process.cwd(),
    now: () => new Date(Date.UTC(2026, 9, 2, 12, 0, tick++)).toISOString(),
    newId: () => `turn-${tick}`,
    onEvent: (_windowId, event) => {
      events.push(event)
    }
  }
  const runner = new TurnRunner(deps)
  runners.push(runner)
  return runner
}

const userTexts = (events: ChatEvent[]): string[] =>
  events
    .filter((event) => event.type === 'message_chunk' && event.role === 'user')
    .map((event) => event.type === 'message_chunk' ? event.text : '')

describe('openSession', () => {
  it('reopens the last session by resume and keeps its model after the header changes', async() => {
    const opened = await boot()
    delete process.env.FAKE_ACP_SCENARIO
    process.env.FAKE_ACP_MODE = 'happy'
    await opened.store.setSelection(opened.root, 'alpha')
    const first = await opened.runner.openSession(windowId, 'pi', 'new')
    expect(first.model).toBe('alpha')
    expect(first.resumable).toBe(true)
    expect(first.events).toEqual([])
    expect(prompts(opened.logPath)).toEqual([])

    await opened.runner.sendMessage(windowId, 'remember-me')
    await opened.runner.setSelection(windowId, 'beta')
    const pid = opened.runner.agentPid()
    expect(pid).not.toBeNull()
    expect(configValues(opened.logPath)).toEqual(['alpha'])

    await opened.runner.sendMessage(windowId, 'still-alpha')
    expect(configValues(opened.logPath)).toEqual(['alpha'])
    expect(opened.runner.agentPid()).toBe(pid)
    expect(await opened.runner.getSelection(windowId)).toEqual({ model: 'beta' })
    const saved = await opened.store.readSession(opened.root, 'pi', first.summary.id)
    expect(saved.model).toBe('alpha')
    expect(saved.summary.acpSessionId).toBeTruthy()

    await opened.runner.disposeHarness()
    fs.writeFileSync(opened.logPath, '')
    const restarted = makeRunner(opened.userData, opened.script, 'pi', [])
    const again = await restarted.openSession(windowId, 'pi', 'last')
    expect(again.summary.id).toBe(first.summary.id)
    expect(again.model).toBe('alpha')
    expect(again.resumable).toBe(true)
    expect(userTexts(again.events)).toEqual(['remember-me', 'still-alpha'])
    expect(prompts(opened.logPath)).toEqual([])
    expect(configValues(opened.logPath)).toEqual([])
    const resumed = inbound(opened.logPath).find((entry) => entry.method === 'session/resume')
    expect(resumed?.params?.sessionId).toBe(saved.summary.acpSessionId)

    await restarted.sendMessage(windowId, 'later')
    expect(prompts(opened.logPath)).toEqual(['later'])
  })

  it('puts a bounded transcript into the first prompt when resume is unavailable', async() => {
    const opened = await boot()
    delete process.env.FAKE_ACP_MODE
    process.env.FAKE_ACP_SCENARIO = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/scenarios/no-resume.json')
    await opened.store.setSelection(opened.root, 'alpha')
    const first = await opened.runner.openSession(windowId, 'pi', 'new')
    expect(first.resumable).toBe(false)
    await opened.runner.sendMessage(windowId, 'remember-me')
    await opened.store.appendEvent(opened.root, 'pi', first.summary.id, {
      type: 'agent_message',
      messageId: 'huge',
      text: 'Z'.repeat(50_000)
    })
    await opened.runner.setSelection(windowId, 'beta')
    await opened.runner.disposeHarness()
    fs.writeFileSync(opened.logPath, '')

    const restarted = makeRunner(opened.userData, opened.script, 'pi', [])
    const again = await restarted.openSession(windowId, 'pi', 'last')
    expect(again.summary.id).toBe(first.summary.id)
    expect(again.model).toBe('alpha')
    expect(again.resumable).toBe(false)
    expect(prompts(opened.logPath)).toEqual([])
    expect(configValues(opened.logPath)).toEqual(['alpha'])
    expect(userTexts(again.events)).toContain('remember-me')

    await restarted.sendMessage(windowId, 'NEXT-USER')
    const prompt = prompts(opened.logPath)[0] ?? ''
    const digest = prompt.slice(0, prompt.length - 'NEXT-USER'.length - 2)
    expect(prompt.endsWith('\n\nNEXT-USER')).toBe(true)
    expect(digest.startsWith(HISTORY_REPLAY_LABEL)).toBe(true)
    expect(digest.length).toBeLessThanOrEqual(HISTORY_REPLAY_MAX_CHARS)
    expect(digest).toContain('Z'.repeat(100))
    expect(digest).not.toContain('remember-me')

    await restarted.sendMessage(windowId, 'after')
    expect(prompts(opened.logPath)[1]).toBe('after')
    const stored = await opened.store.readSession(opened.root, 'pi', first.summary.id)
    expect(userTexts(stored.events).some((text) => text.includes(HISTORY_REPLAY_LABEL))).toBe(false)
    expect(await restarted.getSelection(windowId)).toEqual({ model: 'beta' })
  })

  it('stops the previous harness process when the harness changes', async() => {
    const opened = await boot('both')
    delete process.env.FAKE_ACP_SCENARIO
    process.env.FAKE_ACP_MODE = 'happy'
    await opened.store.setSelection(opened.root, 'alpha')
    await opened.runner.openSession(windowId, 'pi', 'new')
    const firstPid = opened.runner.agentPid()
    if (firstPid == null) throw new Error('missing pid')
    await opened.runner.setSelection(windowId, 'beta')
    expect(alive(firstPid)).toBe(true)
    expect(opened.runner.agentPid()).toBe(firstPid)

    const next = await opened.runner.openSession(windowId, 'cursor', 'new')
    expect(alive(firstPid)).toBe(false)
    const secondPid = opened.runner.agentPid()
    expect(secondPid).not.toBeNull()
    expect(secondPid).not.toBe(firstPid)
    expect(next.model).toBe('beta')
    expect((await opened.runner.listSessions(windowId, 'pi')).map((item) => item.model)).toEqual(['alpha'])
  })

  it('rebinds a session saved with another harness model onto the current selection', async() => {
    const opened = await boot('both')
    await opened.store.setSelection(opened.root, 'beta')
    const created = await opened.store.createSession(opened.root, 'cursor', 'opencode/big-pickle')
    await opened.store.setLastSession(opened.root, 'cursor', created.id)

    const snapshot = await opened.runner.openSession(windowId, 'cursor', 'last')

    expect(snapshot.model).toBe('beta')
    expect(configValues(opened.logPath)).toEqual(['beta'])
    expect((await opened.store.readSession(opened.root, 'cursor', created.id)).model).toBe('beta')
  })
})
