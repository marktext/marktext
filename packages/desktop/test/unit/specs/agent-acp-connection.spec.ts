import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChatEvent, HarnessId } from '@shared/types/agent'
import { AcpAuthRequiredError, AcpConnection } from 'main_renderer/agent/harness/acpConnection'
import type { HarnessQuirks } from 'main_renderer/agent/harness/harnessRegistry'
import { answerPermission } from 'main_renderer/agent/harness/permissionGate'

const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const dirs: string[] = []
const connections: AcpConnection[] = []

afterEach(async() => {
  for (const connection of connections.splice(0)) {
    await connection.dispose()
  }
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-acp-'))
  dirs.push(dir)
  return dir
}

const quirks: HarnessQuirks = { repliesVia: 'block', resume: 'auto' }

const scenarioFile = (name: string): string =>
  path.join(process.cwd(), 'test/fixtures/fake-acp-agent/scenarios', `${name}.json`)

const start = async(
  mode: string,
  harness: HarnessId = 'pi',
  extra?: Partial<HarnessQuirks>,
  killGraceMs?: number,
  permissionChoice = 'allow-once'
): Promise<{ connection: AcpConnection, events: ChatEvent[], logs: string[], logPath: string }> => {
  const cwd = tempDir()
  const logPath = path.join(cwd, 'agent.log')
  const events: ChatEvent[] = []
  const logs: string[] = []
  const scenario = scenarioFile(mode)
  if (fs.existsSync(scenario)) {
    delete process.env.FAKE_ACP_MODE
    process.env.FAKE_ACP_SCENARIO = scenario
  } else {
    delete process.env.FAKE_ACP_SCENARIO
    process.env.FAKE_ACP_MODE = mode
  }
  process.env.FAKE_ACP_LOG = logPath
  process.env.FAKE_ACP_CWD = cwd
  const connection = await AcpConnection.start({
    command: process.execPath,
    args: [fixture],
    cwd,
    harness,
    quirks: { ...quirks, ...extra },
    onEvent: (event) => {
      events.push(event)
      if (event.type === 'permission_request') answerPermission(event.request.requestId, permissionChoice)
    },
    log: (line) => {
      logs.push(line)
    },
    killGraceMs
  })
  connections.push(connection)
  return { connection, events, logs, logPath }
}

const readLog = (logPath: string): unknown[] => {
  if (!fs.existsSync(logPath)) return []
  return fs.readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
}

describe('AcpConnection', () => {
  it('runs initialize, a prompt, and normalized updates through to end_turn', async() => {
    const { connection, events, logs } = await start('happy')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    await connection.setModel(created.sessionId, 'beta')
    const turn = await connection.prompt(created.sessionId, 'review this')

    expect(turn.stopReason).toBe('end_turn')
    expect(events.map((event) => event.type)).toEqual([
      'turn_started',
      'message_chunk',
      'message_chunk',
      'thought_chunk',
      'plan',
      'tool_call',
      'tool_call_update',
      'turn_finished'
    ])
    const agentChunk = events.find((event) => event.type === 'message_chunk' && event.role === 'agent')
    expect(agentChunk).toMatchObject({ text: 'hello' })
    expect(events.find((event) => event.type === 'tool_call')).toMatchObject({
      locations: ['docs/guide.md'],
      status: 'in_progress'
    })
    expect(events.find((event) => event.type === 'tool_call_update')).toMatchObject({
      diffPaths: ['docs/guide.md'],
      status: 'completed'
    })
    const finished = events.find((event) => event.type === 'turn_finished')
    expect(finished).toMatchObject({
      stopReason: 'end_turn',
      changedPaths: ['docs/guide.md'],
      missingReplyThreadIds: []
    })
    expect(events.some((event) => event.type === 'plan' && event.text === 'Read the file')).toBe(true)
    expect(logs.some((line) => line.includes('notice'))).toBe(true)
    expect(connection.agentVersion).toBe('1.2.3')
  })

  it('forwards a permission request and returns the chosen option to the agent', async() => {
    const { connection, events, logPath } = await start('permission-allow')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    const turn = await connection.prompt(created.sessionId, 'go')

    expect(turn.stopReason).toBe('end_turn')
    const request = events.find((event) => event.type === 'permission_request')
    expect(request).toMatchObject({
      type: 'permission_request',
      request: {
        title: 'Run tests',
        options: [
          { id: 'allow-once', label: 'Allow once', kind: 'allow_once' },
          { id: 'reject-once', label: 'Reject once', kind: 'reject_once' }
        ]
      }
    })
    const outcome = readLog(logPath).find((entry) =>
      typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'permission-outcome'
    )
    expect(outcome).toMatchObject({
      outcome: { outcome: 'selected', optionId: 'allow-once' }
    })
  })

  it('answers a pending permission with cancelled when the turn is cancelled', async() => {
    const cwd = tempDir()
    const logPath = path.join(cwd, 'agent.log')
    const events: ChatEvent[] = []
    delete process.env.FAKE_ACP_MODE
    process.env.FAKE_ACP_SCENARIO = scenarioFile('permission-allow')
    process.env.FAKE_ACP_LOG = logPath
    process.env.FAKE_ACP_CWD = cwd
    const connection = await AcpConnection.start({
      command: process.execPath,
      args: [fixture],
      cwd,
      harness: 'pi',
      quirks,
      onEvent: (event) => {
        events.push(event)
        if (event.type === 'permission_request') {
          connection.cancel('sess-1').catch(() => undefined)
        }
      },
      log: () => undefined
    })
    connections.push(connection)
    const created = await connection.newSession({ cwd, mcpServers: [] })
    const turn = await connection.prompt(created.sessionId, 'go')

    expect(turn.stopReason).toBe('cancelled')
    const outcome = readLog(logPath).find((entry) =>
      typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'permission-outcome'
    )
    expect(outcome).toMatchObject({ outcome: { outcome: 'cancelled' } })
  })

  it('finishes with the reject branch when the user rejects the permission', async() => {
    const { connection, events } = await start('permission-reject', 'pi', undefined, undefined, 'reject-once')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    const turn = await connection.prompt(created.sessionId, 'go')

    expect(turn.stopReason).toBe('end_turn')
    const agentChunk = events.find((event) => event.type === 'message_chunk' && event.role === 'agent')
    expect(agentChunk).toMatchObject({ text: 'rejected' })
  })

  it('finishes a cancelled turn with stopReason cancelled', async() => {
    const { connection, events, logPath } = await start('cancel-mid-turn')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    const pending = connection.prompt(created.sessionId, 'go')
    const started = Date.now()
    while (!readLog(logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/prompt'
    )) {
      if (Date.now() - started > 2000) throw new Error('prompt was not delivered')
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    await connection.cancel(created.sessionId)
    const turn = await pending

    expect(turn.stopReason).toBe('cancelled')
    expect(events.some((event) => event.type === 'turn_finished' && event.stopReason === 'cancelled')).toBe(true)
    expect(readLog(logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/cancel'
    )).toBe(true)
  })

  it('reports a crashed agent as an error and starts a new process on the next session', async() => {
    const { connection, events, logPath } = await start('crash')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    const turn = await connection.prompt(created.sessionId, 'go')

    expect(turn.stopReason).toBe('error')
    expect(events.some((event) => event.type === 'error')).toBe(true)
    expect(events.some((event) => event.type === 'turn_finished' && event.stopReason === 'error')).toBe(true)

    delete process.env.FAKE_ACP_SCENARIO
    process.env.FAKE_ACP_MODE = 'happy'
    const again = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    expect(again.sessionId).toBe('sess-1')
    const starts = readLog(logPath).filter((entry) =>
      typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'start'
    )
    expect(starts).toHaveLength(2)
  })

  it('authenticates with the quirk method and surfaces a Cursor hint when that fails', async() => {
    const authed = await start('auth', 'cursor', { authMethodId: 'cursor_login' })
    const created = await authed.connection.newSession({ cwd: authed.connection.cwd, mcpServers: [] })
    expect(created.sessionId).toBe('sess-1')
    expect(readLog(authed.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'authenticate'
    )).toBe(true)

    const failed = await start('auth-fail', 'cursor', { authMethodId: 'cursor_login' })
    await expect(failed.connection.newSession({ cwd: failed.connection.cwd, mcpServers: [] }))
      .rejects.toBeInstanceOf(AcpAuthRequiredError)
    await expect(failed.connection.newSession({ cwd: failed.connection.cwd, mcpServers: [] }))
      .rejects.toThrow('agent login')
  })

  it('resumes with session/resume, falls back to session/load, and refuses when neither exists', async() => {
    const resumed = await start('happy')
    const viaResume = await resumed.connection.resumeSession('kept-1')
    expect(viaResume).toEqual({ kind: 'resumed', sessionId: 'kept-1' })
    expect(readLog(resumed.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/resume'
    )).toBe(true)

    const loaded = await start('load-only')
    const viaLoad = await loaded.connection.resumeSession('kept-2')
    expect(viaLoad).toEqual({ kind: 'resumed', sessionId: 'kept-2' })
    expect(readLog(loaded.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/load'
    )).toBe(true)

    const fresh = await start('no-resume')
    expect(await fresh.connection.resumeSession('kept-3')).toEqual({ kind: 'unsupported' })
    expect(readLog(fresh.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry &&
      (entry.method === 'session/resume' || entry.method === 'session/load')
    )).toBe(false)
  })

  it('closes a session only when the agent advertises close', async() => {
    const opened = await start('happy')
    await opened.connection.close('sess-1')
    expect(readLog(opened.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/close'
    )).toBe(true)

    const bare = await start('no-close')
    await bare.connection.close('sess-1')
    expect(readLog(bare.logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'method' in entry && entry.method === 'session/close'
    )).toBe(false)
  })

  it('emits a marktext-replies block from the scenario', async() => {
    const { connection, events } = await start('block-replies')
    const created = await connection.newSession({ cwd: connection.cwd, mcpServers: [] })
    const turn = await connection.prompt(created.sessionId, 'go')

    expect(turn.stopReason).toBe('end_turn')
    const agentChunk = events.find((event) => event.type === 'message_chunk' && event.role === 'agent')
    const text = agentChunk && agentChunk.type === 'message_chunk' ? agentChunk.text : ''
    expect(text).toContain('```marktext-replies')
    expect(text).toContain('thread-a')
    expect(text).toContain('fixed the line')
  })

  it('kills an agent that ignores SIGTERM', async() => {
    const { connection, logPath } = await start('ignore-term', 'pi', undefined, 100)
    await connection.dispose()
    expect(readLog(logPath).some((entry) =>
      typeof entry === 'object' && entry !== null && 'event' in entry && entry.event === 'sigterm'
    )).toBe(true)
  })
})
