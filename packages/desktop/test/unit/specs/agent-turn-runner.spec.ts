import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChatEvent } from '@shared/types/agent'
import type { Anchor } from '@shared/types/comments'
import { bindCommentsService, commentsService } from 'main_renderer/agent/comments/commentsService'
import { load } from 'main_renderer/agent/comments/commentsStore'
import { setWindowTurn, windowTurn } from 'main_renderer/agent/comments/windowTurn'
import { closeBridgeServer } from 'main_renderer/agent/mcpBridge/bridgeServer'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'
import { SessionStore } from 'main_renderer/agent/sessions/sessionStore'
import { detachChangeTracker, recordEditorSave } from 'main_renderer/agent/turn/changeTracker'
import { TurnRunner } from 'main_renderer/agent/turn/turnRunner'
import type { TurnRunnerDeps } from 'main_renderer/agent/turn/turnRunner'
import { clearWindowAgentHost } from 'main_renderer/agent/windowAgentHost'

const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const windowId = 31
const dirs: string[] = []
const runners: TurnRunner[] = []

afterEach(async() => {
  for (const runner of runners.splice(0)) await runner.disposeHarness()
  await closeBridgeServer()
  detachChangeTracker(windowId)
  setWindowTurn(windowId, null)
  clearWindowAgentHost(windowId)
  repoRegistry.release(windowId)
  for (const key of [
    'FAKE_ACP_MODE',
    'FAKE_ACP_SCENARIO',
    'FAKE_ACP_CWD',
    'FAKE_ACP_WRITE',
    'FAKE_ACP_WRITE_BODY',
    'FAKE_ACP_BLOCK',
    'FAKE_ACP_LOG'
  ]) delete process.env[key]
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-turn-'))
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

const write = (root: string, filePath: string, text: string): void => {
  const full = path.join(root, filePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, text)
}

const harnessScript = (root: string): string => {
  const script = path.join(root, 'fake-harness')
  const body = `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`
  fs.writeFileSync(script, body, { mode: 0o755 })
  fs.chmodSync(script, 0o755)
  return script
}

const quoteAnchor = (quote: string): Anchor => ({
  quote,
  prefix: '',
  suffix: '',
  blockHint: { type: 'paragraph', index: 0 }
})

interface Ready {
  runner: TurnRunner
  root: string
  userData: string
  events: ChatEvent[]
  store: SessionStore
}

const ready = (options?: { modeEnabled?: boolean, onEvent?: (event: ChatEvent) => void }): Ready => {
  const root = tempDir()
  const userData = tempDir()
  const script = harnessScript(root)
  const events: ChatEvent[] = []
  let tick = 0
  let ids = 0
  const deps: TurnRunnerDeps = {
    modeEnabled: () => options?.modeEnabled !== false,
    preference: (key) => key === 'agentPiPath' ? script : '',
    userDataPath: userData,
    appPath: process.cwd(),
    now: () => new Date(Date.UTC(2026, 9, 2, 12, 0, tick++)).toISOString(),
    newId: () => `id-${++ids}`,
    onEvent: (_windowId, event) => {
      events.push(event)
      options?.onEvent?.(event)
    }
  }
  const runner = new TurnRunner(deps)
  runners.push(runner)
  repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
  bindCommentsService({
    now: deps.now,
    newId: deps.newId,
    userName: async() => 'Ada',
    turnOf: windowTurn,
    repoOf: (id) => id === windowId ? root : null,
    onChanged: () => undefined
  })
  return { runner, root, userData, events, store: new SessionStore(path.join(userData, 'agent')) }
}

const initRepo = async(root: string): Promise<void> => {
  await git(root, ['init', '-q'])
  await git(root, ['config', 'user.email', 'tester@example.com'])
  await git(root, ['config', 'user.name', 'Tester'])
  write(root, 'docs/guide.md', 'before\n')
  await git(root, ['add', '--', 'docs/guide.md'])
  await git(root, ['commit', '-qm', 'init'])
}

const createThread = async(root: string, file: string, quote: string): Promise<string> => {
  const saved = await commentsService().apply(windowId, root, {
    op: 'createThread',
    file,
    anchor: quoteAnchor(quote),
    firstText: quote
  })
  const thread = saved.threads.find((item) => item.anchor.quote === quote)
  if (!thread) throw new Error(`thread ${quote} was not created`)
  return thread.id
}

const scenarioFile = (name: string): string =>
  path.join(process.cwd(), 'test/fixtures/fake-acp-agent/scenarios', `${name}.json`)

const arm = (root: string, scenario: string, block: { threadId: string, text: string }[]): void => {
  delete process.env.FAKE_ACP_MODE
  process.env.FAKE_ACP_SCENARIO = scenarioFile(scenario)
  process.env.FAKE_ACP_CWD = root
  process.env.FAKE_ACP_WRITE = 'docs/guide.md'
  process.env.FAKE_ACP_WRITE_BODY = 'after\n'
  if (block.length > 0) process.env.FAKE_ACP_BLOCK = JSON.stringify(block)
  else delete process.env.FAKE_ACP_BLOCK
}

const finished = (events: ChatEvent[]): Extract<ChatEvent, { type: 'turn_finished' }> => {
  const event = events.find((item) => item.type === 'turn_finished')
  if (!event || event.type !== 'turn_finished') throw new Error('turn did not finish')
  return event
}

describe('turnRunner', () => {
  it('rejects a send when the mode, repository, model, or harness is missing', async() => {
    const off = ready({ modeEnabled: false })
    await expect(off.runner.sendMessage(windowId, 'hi')).rejects.toMatchObject({
      name: 'TurnRunnerError',
      code: 'agent_mode_disabled'
    })

    const missingRepo = ready()
    repoRegistry.release(windowId)
    await expect(missingRepo.runner.sendMessage(windowId, 'hi')).rejects.toMatchObject({ code: 'no_repo' })

    const noModel = ready()
    await expect(noModel.runner.sendMessage(windowId, 'hi')).rejects.toMatchObject({ code: 'no_model' })

    const noHarness = ready()
    await noHarness.store.setSelection(noHarness.root, { harness: 'pi', model: 'alpha' })
    fs.rmSync(path.join(noHarness.root, 'fake-harness'))
    await expect(noHarness.runner.sendMessage(windowId, 'hi')).rejects.toMatchObject({ code: 'harness_not_found' })
  })

  it('sends only open threads of the file, records both replies, and skips editor saves and comments', async() => {
    const { runner, root, userData, events, store } = ready({
      onEvent: (event) => {
        if (event.type !== 'turn_started') return
        write(root, 'notes.md', 'human\n')
        recordEditorSave(windowId, path.join(root, 'notes.md'))
      }
    })
    await initRepo(root)
    await store.setSelection(root, { harness: 'pi', model: 'alpha' })
    const first = await createThread(root, 'docs/guide.md', 'alpha quote')
    const second = await createThread(root, 'docs/guide.md', 'beta quote')
    const closed = await createThread(root, 'docs/guide.md', 'closed quote')
    await commentsService().apply(windowId, root, { op: 'setStatus', threadId: closed, status: 'closed' })
    const other = await createThread(root, 'other.md', 'other quote')
    arm(root, 'happy-two-threads', [
      { threadId: first, text: 'fixed first' },
      { threadId: second, text: 'fixed second' }
    ])

    const result = await runner.sendThreads(windowId, 'docs/guide.md', [other, closed, second, first], [
      { threadId: first, orphaned: false, lines: { start: 1, end: 1 } },
      { threadId: second, orphaned: false, lines: { start: 2, end: 2 } }
    ])

    expect(finished(events)).toEqual({
      type: 'turn_finished',
      turnId: result.turnId,
      stopReason: 'end_turn',
      changedPaths: ['docs/guide.md'],
      missingReplyThreadIds: []
    })
    const sessions = await store.listSessions(root, 'pi')
    const snapshot = await store.readSession(root, 'pi', sessions[0]?.id ?? '')
    const prompt = snapshot.events.find((event) => event.type === 'message_chunk' && event.role === 'user')
    expect(prompt && prompt.type === 'message_chunk' ? prompt.text : '').toContain('alpha quote')
    expect(prompt && prompt.type === 'message_chunk' ? prompt.text : '').toContain('beta quote')
    expect(prompt && prompt.type === 'message_chunk' ? prompt.text : '').not.toContain('closed quote')
    expect(prompt && prompt.type === 'message_chunk' ? prompt.text : '').not.toContain('other quote')
    const comments = await load(root, 'docs/guide.md')
    expect(comments.kind).toBe('ok')
    if (comments.kind === 'ok') {
      const byQuote = new Map(comments.file.threads.map((thread) => [thread.anchor.quote, thread]))
      expect(byQuote.get('alpha quote')?.status).toBe('open')
      expect(byQuote.get('beta quote')?.status).toBe('open')
      expect(byQuote.get('alpha quote')?.messages.some((message) => message.author.kind === 'agent')).toBe(true)
      expect(byQuote.get('beta quote')?.messages.some((message) => message.author.kind === 'agent')).toBe(true)
    }
    expect(fs.existsSync(path.join(root, '.marktext/comments/docs/guide.md.json'))).toBe(true)
    expect(fs.readFileSync(path.join(userData, 'agent', 'last-selection.json'), 'utf8')).toContain('"model": "alpha"')
  })

  it('lists the thread the agent did not answer', async() => {
    const { runner, root, events, store } = ready()
    await initRepo(root)
    await store.setSelection(root, { harness: 'pi', model: 'alpha' })
    const first = await createThread(root, 'docs/guide.md', 'alpha quote')
    const second = await createThread(root, 'docs/guide.md', 'beta quote')
    arm(root, 'one-reply-missing', [{ threadId: first, text: 'only first' }])

    await runner.sendThreads(windowId, 'docs/guide.md', [first, second], [
      { threadId: first, orphaned: false, lines: { start: 1, end: 1 } },
      { threadId: second, orphaned: true }
    ])

    expect(finished(events).missingReplyThreadIds).toEqual([second])
    expect(finished(events).changedPaths).toEqual(['docs/guide.md'])
  })

  it('cancels the running turn and rejects another send until it ends', async() => {
    const { runner, root, userData, events, store } = ready()
    await initRepo(root)
    await store.setSelection(root, { harness: 'pi', model: 'alpha' })
    const first = await createThread(root, 'docs/guide.md', 'alpha quote')
    arm(root, 'cancel-mid-turn', [])

    const pending = runner.sendThreads(windowId, 'docs/guide.md', [first], [
      { threadId: first, orphaned: false, lines: { start: 1, end: 1 } }
    ])
    await expect(runner.sendMessage(windowId, 'again')).rejects.toMatchObject({ code: 'turn_in_progress' })
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the turn did not start')), 5000)
      const stop = setInterval(() => {
        if (events.some((event) => event.type === 'message_chunk' && event.role === 'agent')) {
          clearInterval(stop)
          clearTimeout(timer)
          resolve()
        }
      }, 10)
    })
    await runner.cancelTurn()
    await pending

    expect(finished(events).stopReason).toBe('cancelled')
    expect(fs.readFileSync(path.join(root, 'docs/guide.md'), 'utf8')).toBe('after\n')
    expect(fs.existsSync(path.join(userData, 'agent', 'last-selection.json'))).toBe(false)
  })
})
