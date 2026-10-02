#!/usr/bin/env node
/**
 * One-shot ACP harness probe (epic B-0). Not product code.
 *
 *   pnpm exec tsx scripts/acp-probe.ts -- <command…> --cwd <dir>
 *
 * Optional flags (before or after the command):
 *   --prompt <text>           session/prompt after session/new
 *   --set-config <id>=<value> session/set_config_option (select value)
 *   --roundtrip-model         set the first category=model option to its currentValue
 *   --cancel-after-ms <n>     session/cancel this long after the prompt starts
 *   --permission <mode>       allow-once | reject-once | cancelled (default allow-once)
 *   --timeout-ms <n>          prompt timeout (default 180000)
 *
 * The same file is the stdio MCP server (`--mcp`) advertised in session/new.
 * Spawn never sets shell:true. On Windows a bare name is resolved through
 * PATHEXT; a .cmd/.bat match is still spawned without a shell so the EINVAL
 * failure stays visible.
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import {
  PROTOCOL_VERSION,
  RequestError,
  client,
  methods,
  ndJsonStream
} from '@agentclientprotocol/sdk'
import type {
  InitializeResponse,
  NewSessionResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification
} from '@agentclientprotocol/sdk'
import { ensureShellEnvPath, patchEnvPath } from '../packages/desktop/src/main/app/envPath.ts'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const INIT_TIMEOUT_MS = 15_000
const SESSION_NEW_TIMEOUT_MS = 30_000
const DEFAULT_PROMPT_TIMEOUT_MS = 180_000

type PermissionMode = 'allow-once' | 'reject-once' | 'cancelled'

type ProbeArgs = {
  command: string[]
  cwd: string
  prompt: string | null
  setConfig: { configId: string; value: string } | null
  roundtripModel: boolean
  cancelAfterMs: number | null
  permission: PermissionMode
  promptTimeoutMs: number
}

type JsonRecord = Record<string, unknown>

const main = async(): Promise<void> => {
  if (process.argv.includes('--mcp')) {
    await runMcpServer()
    return
  }

  const args = parseArgs(process.argv.slice(2))
  patchEnvPath()
  await ensureShellEnvPath()

  const logPath = path.join(tmpdir(), `acp-probe-${process.pid}.jsonl`)
  const spawnInfo = resolveSpawn(args.command[0])
  const startedAt = Date.now()
  const marks: Record<string, number> = {}
  const mark = (name: string): void => {
    marks[name] = Date.now() - startedAt
  }

  const child = spawn(spawnInfo.file, args.command.slice(1), {
    cwd: args.cwd,
    env: process.env,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const agentStderr: string[] = []
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    agentStderr.push(chunk)
    process.stderr.write(
      chunk
        .split('\n')
        .filter(Boolean)
        .map((line) => `[agent] ${line}\n`)
        .join('')
    )
  })

  const childExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once('error', () => resolve({ code: null, signal: null }))
      child.once('exit', (code, signal) => resolve({ code, signal }))
    }
  )

  if (!child.stdin || !child.stdout) {
    throw new Error('spawn did not provide stdio pipes')
  }

  const updates: SessionNotification[] = []
  const permissions: JsonRecord[] = []
  const stream = ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
  )

  const report: JsonRecord = {
    sdk: { package: '@agentclientprotocol/sdk', protocolVersionSent: PROTOCOL_VERSION },
    spawn: {
      platform: process.platform,
      shell: false,
      command: args.command,
      file: spawnInfo.file,
      note: spawnInfo.note,
      pathext: process.env.PATHEXT ?? null
    },
    cwd: args.cwd,
    marks,
    initialize: null,
    sessionNew: null,
    setConfig: null,
    prompt: null,
    permissions,
    toolEvidence: [],
    mcpLog: null,
    close: null
  }

  const finish = (exitCode: number): void => {
    report.toolEvidence = toolEvidence(updates)
    report.sessionUpdates = updates
    report.mcpLog = readMcpLog(logPath)
    report.agentStderr = agentStderr.join('').slice(-8000)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    process.exit(exitCode)
  }

  try {
    await client({ name: 'marktext-acp-probe' })
      .onRequest(methods.client.session.requestPermission, (ctx) => {
        const response = answerPermission(ctx.params, args.permission)
        permissions.push({ request: ctx.params, response })
        return response
      })
      .onNotification(methods.client.session.update, (ctx) => {
        updates.push(ctx.params)
      })
      .connectWith(stream, async(ctx) => {
        mark('initializeStart')
        const init = await withTimeout(
          ctx.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
            clientInfo: { name: 'marktext-acp-probe', version: '0.0.0' },
            // Same surface the editor will advertise: no fs, no terminal (overview §4).
            clientCapabilities: {}
          }),
          INIT_TIMEOUT_MS,
          'initialize'
        )
        mark('initializeDone')
        report.initialize = summarizeInitialize(init)

        mark('sessionNewStart')
        const created = await withTimeout(
          ctx.request<NewSessionResponse>(methods.agent.session.new, {
            cwd: args.cwd,
            mcpServers: [
              {
                name: 'probe',
                command: process.execPath,
                args: mcpServerArgs(),
                env: [{ name: 'ACP_PROBE_LOG', value: logPath }]
              }
            ]
          }),
          SESSION_NEW_TIMEOUT_MS,
          'session/new'
        )
        mark('sessionNewDone')
        report.sessionNew = created

        const setConfig = args.setConfig ?? (args.roundtripModel ? roundtripModel(created) : null)
        if (setConfig) {
          mark('setConfigStart')
          try {
            const setResult = await withTimeout(
              ctx.request(methods.agent.session.setConfigOption, {
                sessionId: created.sessionId,
                configId: setConfig.configId,
                value: setConfig.value
              }),
              INIT_TIMEOUT_MS,
              'session/set_config_option'
            )
            report.setConfig = { request: setConfig, result: setResult }
          } catch (error) {
            report.setConfig = { request: setConfig, error: errorInfo(error) }
          }
          mark('setConfigDone')
        }

        if (args.prompt) {
          mark('promptStart')
          const promptStarted = Date.now()
          let cancelSent = false
          const cancelTimer =
            args.cancelAfterMs == null
              ? null
              : setTimeout(() => {
                cancelSent = true
                mark('cancelSent')
                ctx
                  .notify(methods.agent.session.cancel, { sessionId: created.sessionId })
                  .catch((error: unknown) => {
                    process.stderr.write(
                      `[probe] session/cancel failed: ${error instanceof Error ? error.message : String(error)}\n`
                    )
                  })
              }, args.cancelAfterMs)
          try {
            const promptResult = await withTimeout(
              ctx.request(methods.agent.session.prompt, {
                sessionId: created.sessionId,
                prompt: [{ type: 'text', text: args.prompt }]
              }),
              args.promptTimeoutMs,
              'session/prompt'
            )
            report.prompt = {
              text: args.prompt,
              cancelSent,
              elapsedMs: Date.now() - promptStarted,
              result: promptResult
            }
          } catch (error) {
            report.prompt = {
              text: args.prompt,
              cancelSent,
              elapsedMs: Date.now() - promptStarted,
              error: errorInfo(error)
            }
          } finally {
            if (cancelTimer) clearTimeout(cancelTimer)
          }
          mark('promptDone')
        }

        const closeAdvertised = init.agentCapabilities?.sessionCapabilities?.close != null
        if (closeAdvertised) {
          try {
            const closed = await withTimeout(
              ctx.request(methods.agent.session.close, { sessionId: created.sessionId }),
              INIT_TIMEOUT_MS,
              'session/close'
            )
            report.close = { attempted: true, result: closed }
          } catch (error) {
            report.close = { attempted: true, error: errorInfo(error) }
          }
        } else {
          report.close = { attempted: false, reason: 'sessionCapabilities.close is absent' }
        }
        mark('closeDone')
      })
  } catch (error) {
    report.error = errorInfo(error)
  } finally {
    if (child.exitCode == null && child.signalCode == null) {
      child.kill('SIGTERM')
      await Promise.race([childExit, delay(2000)])
      if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL')
    }
    const exited = await Promise.race([childExit, delay(1000).then(() => null)])
    report.agentExit = exited
  }

  finish(report.error ? 1 : 0)
}

const parseArgs = (argv: string[]): ProbeArgs => {
  const command: string[] = []
  let cwd: string | null = null
  let prompt: string | null = null
  let setConfig: ProbeArgs['setConfig'] = null
  let roundtripModel = false
  let cancelAfterMs: number | null = null
  let permission: PermissionMode = 'allow-once'
  let promptTimeoutMs = DEFAULT_PROMPT_TIMEOUT_MS

  const need = (flag: string, index: number): string => {
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`)
    }
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--') continue
    if (token === '--help' || token === '-h') {
      process.stdout.write('pnpm exec tsx scripts/acp-probe.ts -- <command…> --cwd <dir>\n')
      process.exit(0)
    }
    if (token === '--cwd') {
      cwd = path.resolve(need(token, i))
      i++
      continue
    }
    if (token === '--prompt') {
      prompt = need(token, i)
      i++
      continue
    }
    if (token === '--set-config') {
      const raw = need(token, i)
      const eq = raw.indexOf('=')
      if (eq <= 0) throw new Error('--set-config expects <id>=<value>')
      setConfig = { configId: raw.slice(0, eq), value: raw.slice(eq + 1) }
      i++
      continue
    }
    if (token === '--roundtrip-model') {
      roundtripModel = true
      continue
    }
    if (token === '--cancel-after-ms') {
      cancelAfterMs = Number(need(token, i))
      if (!Number.isFinite(cancelAfterMs) || cancelAfterMs < 0) {
        throw new Error('--cancel-after-ms expects a non-negative number')
      }
      i++
      continue
    }
    if (token === '--permission') {
      const mode = need(token, i)
      if (mode !== 'allow-once' && mode !== 'reject-once' && mode !== 'cancelled') {
        throw new Error('--permission expects allow-once, reject-once, or cancelled')
      }
      permission = mode
      i++
      continue
    }
    if (token === '--timeout-ms') {
      promptTimeoutMs = Number(need(token, i))
      if (!Number.isFinite(promptTimeoutMs) || promptTimeoutMs <= 0) {
        throw new Error('--timeout-ms expects a positive number')
      }
      i++
      continue
    }
    command.push(token)
  }

  if (!cwd) throw new Error('missing --cwd <dir>')
  if (command.length === 0) throw new Error('missing harness command')
  if (cancelAfterMs != null && !prompt) throw new Error('--cancel-after-ms requires --prompt')
  return {
    command,
    cwd,
    prompt,
    setConfig,
    roundtripModel,
    cancelAfterMs,
    permission,
    promptTimeoutMs
  }
}

/** Bare names on Windows are not subject to PATHEXT unless a shell is involved. */
const resolveSpawn = (file: string): { file: string; note: string } => {
  if (process.platform !== 'win32' || path.win32.extname(file)) {
    return {
      file,
      note:
        process.platform === 'win32'
          ? 'command already has an extension; spawned with shell:false'
          : 'POSIX spawn searches PATH; shell is not used'
    }
  }
  const suffixes = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    for (const suffix of suffixes) {
      const candidate = path.win32.join(dir, file + suffix)
      if (!existsSync(candidate)) continue
      const batch = suffix.toLowerCase() === '.cmd' || suffix.toLowerCase() === '.bat'
      return {
        file: candidate,
        note: batch
          ? `PATHEXT resolved ${candidate}. Node refuses .cmd/.bat without a shell (EINVAL); shell stays false.`
          : `PATHEXT resolved ${candidate}; spawned with shell:false`
      }
    }
  }
  return { file, note: 'no PATHEXT match; spawning the bare name with shell:false' }
}

const mcpServerArgs = (): string[] => {
  const require = createRequire(import.meta.url)
  return ['--import', require.resolve('tsx'), SCRIPT_PATH, '--mcp']
}

const roundtripModel = (
  created: NewSessionResponse
): { configId: string; value: string } | null => {
  const option = created.configOptions?.find(
    (item) => item.category === 'model' && item.type === 'select'
  )
  if (!option || typeof option.currentValue !== 'string') return null
  return { configId: option.id, value: option.currentValue }
}

const answerPermission = (
  request: RequestPermissionRequest,
  mode: PermissionMode
): RequestPermissionResponse => {
  if (mode === 'cancelled') return { outcome: { outcome: 'cancelled' } }
  const wanted = mode === 'allow-once' ? 'allow_once' : 'reject_once'
  const match = request.options.find((option) => option.kind === wanted) ?? request.options[0]
  if (!match) return { outcome: { outcome: 'cancelled' } }
  return { outcome: { outcome: 'selected', optionId: match.optionId } }
}

const summarizeInitialize = (init: InitializeResponse): JsonRecord => {
  const caps = init.agentCapabilities
  return {
    protocolVersion: init.protocolVersion,
    agentInfo: init.agentInfo ?? null,
    authMethods: init.authMethods ?? [],
    loadSession: caps?.loadSession === true,
    sessionResume: caps?.sessionCapabilities?.resume != null,
    sessionClose: caps?.sessionCapabilities?.close != null,
    mcpCapabilities: caps?.mcpCapabilities ?? null,
    promptCapabilities: caps?.promptCapabilities ?? null,
    sessionCapabilities: caps?.sessionCapabilities ?? null,
    raw: init
  }
}

const toolEvidence = (updates: SessionNotification[]): JsonRecord[] => {
  const rows: JsonRecord[] = []
  for (const note of updates) {
    const update = note.update
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') { continue }
    const content = update.content ?? []
    rows.push({
      sessionUpdate: update.sessionUpdate,
      toolCallId: update.toolCallId,
      title: 'title' in update ? (update.title ?? null) : null,
      name: update.name ?? null,
      kind: update.kind ?? null,
      status: update.status ?? null,
      locations: update.locations ?? null,
      contentTypes: content.map((block) => block.type),
      diffPaths: content.flatMap((block) => (block.type === 'diff' ? [block.path] : []))
    })
  }
  return rows
}

const readMcpLog = (logPath: string): unknown => {
  if (!existsSync(logPath)) return null
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as unknown
      } catch {
        return line
      }
    })
}

const errorInfo = (error: unknown): JsonRecord => {
  if (error instanceof RequestError) {
    return { message: error.message, code: error.code, data: error.data ?? null }
  }
  if (error instanceof Error) return { message: error.message, name: error.name }
  return { message: String(error) }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

type RpcMessage = {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: JsonRecord
}

const runMcpServer = async(): Promise<void> => {
  const logPath = process.env.ACP_PROBE_LOG
  const log = async(event: JsonRecord): Promise<void> => {
    if (!logPath) return
    await mkdirParent(logPath)
    await appendFile(logPath, `${JSON.stringify({ t: new Date().toISOString(), ...event })}\n`)
  }
  await log({ event: 'process-start', execPath: process.execPath, argv: process.argv })

  let framing: 'ndjson' | 'content-length' = 'ndjson'
  for await (const message of readRpc(process.stdin, (kind) => {
    framing = kind
  })) {
    const rpc = message as RpcMessage
    if (rpc.id == null || !rpc.method) {
      await log({ event: 'notification', method: rpc.method ?? null })
      continue
    }
    await log({ event: 'request', method: rpc.method, id: rpc.id })
    const result = mcpResult(rpc.method, rpc.params ?? {})
    if (rpc.method === 'tools/call') {
      await log({
        event: 'tools/call',
        name: rpc.params?.name ?? null,
        arguments: rpc.params?.arguments ?? null
      })
    }
    writeRpc(process.stdout, framing, { jsonrpc: '2.0', id: rpc.id, result })
  }
}

const mcpResult = (method: string, params: JsonRecord): JsonRecord => {
  if (method === 'initialize') {
    const requested =
      typeof params.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05'
    return {
      protocolVersion: requested,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'probe', version: '0.0.0' }
    }
  }
  if (method === 'tools/list') {
    return {
      tools: [
        {
          name: 'ping',
          description: 'Returns the text pong. Probe tool for MarkText ACP spike B-0.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false }
        }
      ]
    }
  }
  if (method === 'ping' || method === 'notifications/initialized') {
    return {}
  }
  if (method === 'tools/call') {
    const name = params.name
    if (name !== 'ping') {
      return { content: [{ type: 'text', text: `unknown tool ${String(name)}` }], isError: true }
    }
    return { content: [{ type: 'text', text: 'pong' }], isError: false }
  }
  return { error: 'method not found', method }
}

const writeRpc = (
  stream: NodeJS.WritableStream,
  framing: 'ndjson' | 'content-length',
  message: JsonRecord
): void => {
  const body = JSON.stringify(message)
  if (framing === 'content-length') {
    stream.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
    return
  }
  stream.write(`${body}\n`)
}

async function * readRpc(
  stream: NodeJS.ReadableStream,
  onFraming: (kind: 'ndjson' | 'content-length') => void
): AsyncGenerator<unknown> {
  let buf = Buffer.alloc(0)
  for await (const chunk of stream) {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
    while (buf.length > 0) {
      const start = buf.findIndex((byte) => byte !== 0x0d && byte !== 0x0a && byte !== 0x20)
      if (start < 0) {
        buf = Buffer.alloc(0)
        break
      }
      if (start > 0) buf = buf.subarray(start)
      if (buf[0] === 0x7b) {
        const newline = buf.indexOf(0x0a)
        if (newline < 0) break
        onFraming('ndjson')
        const line = buf.subarray(0, newline).toString('utf8').replace(/\r$/, '')
        buf = buf.subarray(newline + 1)
        if (line.trim()) yield JSON.parse(line) as unknown
        continue
      }
      const sep = indexOfHeaderEnd(buf)
      if (!sep) break
      onFraming('content-length')
      const header = buf.subarray(0, sep.index).toString('utf8')
      const match = /content-length:\s*(\d+)/i.exec(header)
      if (!match) throw new Error(`MCP header without Content-Length: ${header}`)
      const length = Number(match[1])
      const bodyStart = sep.index + sep.length
      if (buf.length < bodyStart + length) break
      const body = buf.subarray(bodyStart, bodyStart + length).toString('utf8')
      buf = buf.subarray(bodyStart + length)
      yield JSON.parse(body) as unknown
    }
  }
}

const indexOfHeaderEnd = (buf: Buffer): { index: number; length: number } | null => {
  const crlf = buf.indexOf('\r\n\r\n')
  if (crlf >= 0) return { index: crlf, length: 4 }
  const lf = buf.indexOf('\n\n')
  if (lf >= 0) return { index: lf, length: 2 }
  return null
}

const mkdirParent = async(filePath: string): Promise<void> => {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  )
  process.exit(1)
})
