import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { HarnessId } from '@shared/types/agent'
import { repoHash, SessionStore } from 'main_renderer/agent/sessions/sessionStore'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-sessions-'))
  dirs.push(dir)
  return dir
}

const logFile = (agentDir: string, root: string, harness: HarnessId, sessionId: string): string =>
  path.join(agentDir, 'sessions', repoHash(root), harness, `${sessionId}.jsonl`)

describe('sessionStore', () => {
  it('creates a session under the repository hash and keeps the path in repos.json', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const store = new SessionStore(agentDir)
    const session = await store.createSession(root, 'opencode', 'claude')

    expect(repoHash(root)).toMatch(/^[0-9a-f]{16}$/)
    expect(fs.existsSync(logFile(agentDir, root, 'opencode', session.id))).toBe(true)
    const repos = JSON.parse(fs.readFileSync(path.join(agentDir, 'repos.json'), 'utf8')) as Record<string, unknown>
    expect(repos[path.resolve(root)]).toEqual({ selection: null, lastSession: {} })
    expect(session).toMatchObject({ model: 'claude', title: '', acpSessionId: null })
  })

  it('titles a free chat from the first user message and a comments chat from the file', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const store = new SessionStore(agentDir)
    const chat = await store.createSession(root, 'cursor', 'composer')
    const text = 'я'.repeat(80)
    await store.appendEvent(root, 'cursor', chat.id, { type: 'user_message', messageId: '1', text })
    await store.appendEvent(root, 'cursor', chat.id, { type: 'user_message', messageId: '2', text: 'второе' })

    const [summary] = await store.listSessions(root, 'cursor')
    expect(summary.title).toBe('я'.repeat(60))

    const comments = await store.createSession(root, 'pi', 'inflection', { file: 'docs/guide.md' })
    expect(comments.title).toBe('Комментарии: docs/guide.md')
    await store.appendEvent(root, 'pi', comments.id, {
      type: 'user_message',
      messageId: '1',
      text: 'Review the threads in docs/guide.md and reply to each one.'
    })
    const [commentsSummary] = await store.listSessions(root, 'pi')
    expect(commentsSummary.title).toBe('Комментарии: docs/guide.md')
  })

  it('reopens the last session from a new store', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const store = new SessionStore(agentDir)
    const older = await store.createSession(root, 'opencode', 'old-model')
    await store.appendEvent(root, 'opencode', older.id, { type: 'user_message', messageId: 'a', text: 'старое' })
    const current = await store.createSession(root, 'opencode', 'new-model')
    await store.appendEvent(root, 'opencode', current.id, { type: 'user_message', messageId: 'b', text: 'новое' })
    await store.appendEvent(root, 'opencode', current.id, {
      type: 'turn_finished',
      turnId: 'turn-1',
      stopReason: 'end_turn',
      changedPaths: ['docs/guide.md'],
      missingReplyThreadIds: []
    })
    await store.setLastSession(root, 'opencode', current.id)

    const restarted = new SessionStore(agentDir)
    const last = await restarted.getLastSession(root, 'opencode')
    expect(last).toBe(current.id)
    const snapshot = await restarted.readSession(root, 'opencode', last ?? '')
    expect(snapshot.model).toBe('new-model')
    expect(snapshot.events).toEqual([
      { type: 'message_chunk', role: 'user', messageId: 'b', text: 'новое' },
      {
        type: 'turn_finished',
        turnId: 'turn-1',
        stopReason: 'end_turn',
        changedPaths: ['docs/guide.md'],
        missingReplyThreadIds: []
      }
    ])
  })

  it('keeps earlier sessions when a new chat is created', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const store = new SessionStore(agentDir)
    const first = await store.createSession(root, 'pi', 'alpha')
    await store.appendEvent(root, 'pi', first.id, { type: 'user_message', messageId: 'a', text: 'первый' })
    const second = await store.createSession(root, 'pi', 'beta')

    const listed = await store.listSessions(root, 'pi')
    expect(listed.map((item) => item.id)).toEqual([first.id, second.id])
    expect(fs.existsSync(logFile(agentDir, root, 'pi', first.id))).toBe(true)
    expect(fs.existsSync(logFile(agentDir, root, 'pi', second.id))).toBe(true)
    const snapshot = await store.readSession(root, 'pi', first.id)
    expect(snapshot.events).toEqual([
      { type: 'message_chunk', role: 'user', messageId: 'a', text: 'первый' }
    ])
  })

  it('skips a truncated final jsonl line', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const store = new SessionStore(agentDir)
    const session = await store.createSession(root, 'opencode', 'claude')
    await store.appendEvent(root, 'opencode', session.id, { type: 'user_message', messageId: 'a', text: 'целое' })
    fs.appendFileSync(logFile(agentDir, root, 'opencode', session.id), '{"type":"agent_message","messageId":"b","text":"обр')

    await store.appendEvent(root, 'opencode', session.id, {
      type: 'turn_finished',
      turnId: 'turn-1',
      stopReason: 'error',
      changedPaths: [],
      missingReplyThreadIds: []
    })
    const snapshot = await store.readSession(root, 'opencode', session.id)
    expect(snapshot.events).toEqual([
      { type: 'message_chunk', role: 'user', messageId: 'a', text: 'целое' },
      {
        type: 'turn_finished',
        turnId: 'turn-1',
        stopReason: 'error',
        changedPaths: [],
        missingReplyThreadIds: []
      }
    ])
  })

  it('offers the last successful pair only when that model is still listed', async() => {
    const agentDir = tempDir()
    const root = tempDir()
    const other = tempDir()
    const store = new SessionStore(agentDir)
    await store.setSelection(root, { harness: 'pi', model: 'alpha' })
    expect(await store.getSelection(other, { pi: ['alpha'] })).toBeNull()
    expect(fs.existsSync(path.join(agentDir, 'last-selection.json'))).toBe(false)

    await store.setSelection(root, { harness: 'pi', model: 'alpha' }, { used: true })
    expect(await store.getSelection(other, { pi: ['alpha', 'beta'] })).toEqual({ harness: 'pi', model: 'alpha' })
    expect(await store.getSelection(other, { pi: ['beta'] })).toBeNull()
    expect(await store.getSelection(other, { opencode: ['alpha'] })).toBeNull()
    expect(await store.getSelection(root, { pi: [] })).toEqual({ harness: 'pi', model: 'alpha' })
  })
})
