import { spawn, type ChildProcess } from 'child_process'
import os from 'os'
import readline from 'readline'
import {
  ACP_INIT_TIMEOUT_MS,
  HARNESS_IDS,
  type HarnessId,
  type HarnessStatus,
  type HarnessStatusReason
} from '@shared/types/agent'
import { resolveHarnessCommand } from './resolveHarnessCommand'

export interface HarnessQuirks {
  repliesVia: 'mcp' | 'block'
  resume: 'auto' | 'none'
  authMethodId?: string
}

export interface HarnessDescriptor {
  id: HarnessId
  displayName: string
  defaultCommand: string
  defaultArgs: readonly string[]
  quirks: HarnessQuirks
}

/**
 * Quirks from the B-0 spike (`docs/agent/harness-spike.md`). Pi and Cursor
 * `repliesVia` are still the unverified hypothesis from that note.
 */
export const HARNESS_DESCRIPTORS: readonly HarnessDescriptor[] = [
  {
    id: 'opencode',
    displayName: 'OpenCode',
    defaultCommand: 'opencode',
    defaultArgs: ['acp'],
    quirks: {
      repliesVia: 'mcp',
      resume: 'auto',
      authMethodId: 'opencode-login'
    }
  },
  {
    id: 'pi',
    displayName: 'Pi',
    defaultCommand: 'pi-acp',
    defaultArgs: [],
    quirks: {
      repliesVia: 'block',
      resume: 'auto'
    }
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    defaultCommand: 'agent',
    defaultArgs: ['acp'],
    quirks: {
      repliesVia: 'block',
      resume: 'auto',
      authMethodId: 'cursor_login'
    }
  }
]

export const HARNESS_PATH_KEYS: Record<HarnessId, string> = {
  opencode: 'agentOpencodePath',
  pi: 'agentPiPath',
  cursor: 'agentCursorPath'
}

const CLIENT_INFO = { name: 'MarkText', version: '0.21.0-dev' }
const PROTOCOL_VERSION = 1
const STDERR_LIMIT = 8 * 1024

export const harnessPathsFromPreferences = (
  get: (key: string) => unknown
): Record<HarnessId, string> => {
  const paths = {} as Record<HarnessId, string>
  for (const id of HARNESS_IDS) {
    const value = get(HARNESS_PATH_KEYS[id])
    paths[id] = typeof value === 'string' ? value : ''
  }
  return paths
}

export const changedHarnessIds = (change: object): HarnessId[] => {
  const record = change as Record<string, unknown>
  const ids: HarnessId[] = []
  for (const id of HARNESS_IDS) {
    if (Object.prototype.hasOwnProperty.call(record, HARNESS_PATH_KEYS[id])) ids.push(id)
  }
  return ids
}

interface CacheEntry {
  configuredPath: string
  status: HarnessStatus
}

const cache = new Map<HarnessId, CacheEntry>()
const tickets = new Map<HarnessId, number>()
let ticket = 0

export const clearHarnessStatusCache = (): void => {
  cache.clear()
  ticket += 1
  for (const id of HARNESS_IDS) tickets.set(id, ticket)
}

export const invalidateHarnessStatus = (ids: readonly HarnessId[]): void => {
  ticket += 1
  for (const id of ids) {
    cache.delete(id)
    tickets.set(id, ticket)
  }
}

const descriptorFor = (id: HarnessId): HarnessDescriptor => {
  const found = HARNESS_DESCRIPTORS.find((descriptor) => descriptor.id === id)
  if (!found) throw new Error(`unknown harness ${id}`)
  return found
}

type ProbeResult =
  | { ok: true, version: string | null }
  | { ok: false, reason: 'not_found' | 'not_executable' }
  | { ok: false, reason: 'init_failed', message: string }
  | { ok: false, reason: 'auth_required' }

const mentionsAuthRequired = (error: unknown): boolean => {
  try {
    return JSON.stringify(error).includes('auth_required')
  } catch {
    return false
  }
}

const stopChild = (child: ChildProcess): void => {
  if (child.pid == null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true
    })
    killer.on('error', () => {
      child.kill()
    })
    return
  }
  child.kill()
}

/**
 * One `initialize`, then the process is stopped. Client capabilities stay
 * empty: the editor does not offer `fs` or `terminal` (overview §4).
 * `authMethods` on a successful result are not `auth_required` — OpenCode
 * advertises `opencode-login` and still accepts a session.
 */
const probeInitialize = (
  command: string,
  args: readonly string[]
): Promise<ProbeResult> => new Promise((resolve) => {
  let settled = false
  const child = spawn(command, args, {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    cwd: os.tmpdir()
  })

  const timer = setTimeout(() => {
    finish({ ok: false, reason: 'init_failed', message: 'initialize timed out' })
  }, ACP_INIT_TIMEOUT_MS)

  const finish = (value: ProbeResult): void => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    stopChild(child)
    resolve(value)
  }

  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      finish({ ok: false, reason: 'not_found' })
      return
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      finish({ ok: false, reason: 'not_executable' })
      return
    }
    finish({ ok: false, reason: 'init_failed', message: err.message })
  })

  const stderr: Buffer[] = []
  let stderrBytes = 0
  child.stderr?.on('data', (chunk: Buffer) => {
    if (stderrBytes >= STDERR_LIMIT) return
    stderr.push(chunk)
    stderrBytes += chunk.length
  })

  child.on('exit', (code) => {
    const tail = Buffer.concat(stderr).toString('utf8').slice(-500).trim()
    finish({
      ok: false,
      reason: 'init_failed',
      message: tail || `initialize exited ${code ?? 'null'}`
    })
  })

  if (!child.stdout || !child.stdin) {
    finish({ ok: false, reason: 'init_failed', message: 'initialize has no stdio' })
    return
  }

  child.stdin.on('error', (err: NodeJS.ErrnoException) => {
    // EPIPE means the child exited before the request was flushed. The exit path reports that.
    if (err.code !== 'EPIPE') finish({ ok: false, reason: 'init_failed', message: err.message })
  })

  const lines = readline.createInterface({ input: child.stdout })
  lines.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let message: { id?: unknown, result?: { agentInfo?: { version?: unknown } }, error?: unknown }
    try {
      message = JSON.parse(trimmed) as typeof message
    } catch {
      return
    }
    if (message.id !== 1) return
    if (message.error !== undefined) {
      if (mentionsAuthRequired(message.error)) {
        finish({ ok: false, reason: 'auth_required' })
        return
      }
      const text = typeof message.error === 'object' && message.error && 'message' in message.error
        ? String((message.error as { message: unknown }).message)
        : 'initialize failed'
      finish({ ok: false, reason: 'init_failed', message: text })
      return
    }
    const version = message.result?.agentInfo?.version
    finish({ ok: true, version: typeof version === 'string' ? version : null })
  })

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: CLIENT_INFO,
      clientCapabilities: {}
    }
  }
  child.stdin.write(`${JSON.stringify(request)}\n`)
})

const unavailable = (
  id: HarnessId,
  reason: HarnessStatusReason,
  resolvedPath: string | null,
  message: string | null
): HarnessStatus => ({
  id,
  found: false,
  resolvedPath,
  version: null,
  reason,
  message
})

const statusFor = async(
  id: HarnessId,
  configuredPath: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): Promise<HarnessStatus> => {
  const descriptor = descriptorFor(id)
  const resolved = resolveHarnessCommand(
    descriptor.defaultCommand,
    descriptor.defaultArgs,
    configuredPath,
    env,
    platform
  )
  if (!resolved.ok) {
    return unavailable(
      id,
      resolved.reason,
      resolved.reason === 'not_executable' ? resolved.resolvedPath : null,
      null
    )
  }

  const probed = await probeInitialize(resolved.command, resolved.args)
  if (!probed.ok) {
    if (probed.reason === 'init_failed') {
      return {
        id,
        found: true,
        resolvedPath: resolved.resolvedPath,
        version: null,
        reason: 'init_failed',
        message: probed.message
      }
    }
    if (probed.reason === 'auth_required') {
      return {
        id,
        found: true,
        resolvedPath: resolved.resolvedPath,
        version: null,
        reason: 'auth_required',
        message: null
      }
    }
    return unavailable(id, probed.reason, resolved.resolvedPath, null)
  }

  return {
    id,
    found: true,
    resolvedPath: resolved.resolvedPath,
    version: probed.version,
    reason: null,
    message: null
  }
}

const loadOne = async(
  id: HarnessId,
  configuredPath: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): Promise<HarnessStatus> => {
  const cached = cache.get(id)
  if (cached && cached.configuredPath === configuredPath) return cached.status

  const mine = ++ticket
  tickets.set(id, mine)
  const status = await statusFor(id, configuredPath, env, platform)
  if (tickets.get(id) === mine) {
    cache.set(id, { configuredPath, status })
  }
  return status
}

/**
 * A result is reused until that harness's settings path changes.
 * `no_models` is not decided here: an empty catalog is recorded by the session probe.
 */
export const getHarnessStatus = async(
  paths: Partial<Record<HarnessId, string>>,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): Promise<HarnessStatus[]> => {
  const statuses = await Promise.all(HARNESS_IDS.map((id) =>
    loadOne(id, paths[id] ?? '', env, platform)
  ))
  return statuses
}
