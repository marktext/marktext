import { randomBytes } from 'crypto'
import fs from 'fs'
import net from 'net'
import path from 'path'
import log from 'electron-log'
import { MCP_TOOL_REPLY } from '@shared/types/agent'
import { CommentsServiceError, commentsService } from '../comments/commentsService'
import { windowTurn } from '../comments/windowTurn'
import { repoRegistry } from '../repo/repoRegistry'

export interface WindowBridge {
  /** Unix socket path, or a Windows named pipe. */
  address: string
  /** 32 random bytes, hex. Names the window until `releaseWindowBridge`. */
  token: string
}

const TURN_THREAD_ERROR = 'thread is not part of the current turn'

const tokens = new Map<string, number>()
const tokensByWindow = new Map<number, string>()
const sockets = new Set<net.Socket>()
const socketTail = new WeakMap<net.Socket, Promise<void>>()

let server: net.Server | null = null
let address: string | null = null
let opening: Promise<string> | null = null

const repoOf = (windowId: number): string | null => {
  const state = repoRegistry.state(windowId)
  return state.kind === 'repo' ? state.root : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Listen path for this process. Named pipes are not files under userData. */
export const bridgeListenPath = (
  userDataPath: string,
  name: string,
  platform: NodeJS.Platform = process.platform
): string =>
  platform === 'win32'
    ? `\\\\.\\pipe\\marktext-agent-${name}`
    : path.join(userDataPath, 'agent', 'run', `${name}.sock`)

const fail = (error: string): string => JSON.stringify({ ok: false, error })

const handleLine = async(line: string): Promise<string> => {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return fail('invalid request')
  }
  if (!isRecord(value) || typeof value.token !== 'string' || value.token.length === 0) {
    return fail('invalid request')
  }
  const windowId = tokens.get(value.token)
  if (windowId == null) return fail('unknown token')
  if (value.method !== MCP_TOOL_REPLY) return fail('unknown method')
  if (!isRecord(value.params)) return fail('invalid request')
  const { threadId, text } = value.params
  if (typeof threadId !== 'string' || threadId.length === 0 || typeof text !== 'string') {
    return fail('invalid request')
  }

  const root = repoOf(windowId)
  if (!root) return fail('the window has no repository')
  const turnId = windowTurn(windowId)?.turnId ?? ''
  try {
    await commentsService().apply(windowId, root, {
      op: 'appendAgentReply',
      turnId,
      threadId,
      text
    })
  } catch (error) {
    if (error instanceof CommentsServiceError && error.code === 'turn_thread') {
      return fail(TURN_THREAD_ERROR)
    }
    return fail(error instanceof Error ? error.message : 'reply failed')
  }
  return JSON.stringify({ ok: true })
}

const enqueue = (socket: net.Socket, job: () => Promise<void>): void => {
  const previous = socketTail.get(socket) ?? Promise.resolve()
  const run = previous.then(job, job)
  socketTail.set(socket, run.then(() => undefined, () => undefined))
}

const onConnection = (socket: net.Socket): void => {
  sockets.add(socket)
  socket.setEncoding('utf8')
  let buffer = ''
  socket.on('data', (chunk: string) => {
    buffer += chunk
    if (buffer.length > 256 * 1024) {
      socket.destroy()
      return
    }
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '')
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
      if (line.length === 0) continue
      enqueue(socket, async() => {
        const response = await handleLine(line)
        if (!socket.destroyed) socket.write(`${response}\n`)
      })
    }
  })
  socket.on('close', () => {
    sockets.delete(socket)
  })
  socket.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE' && error.code !== 'ECONNRESET') log.error(error)
  })
}

const listen = (userDataPath: string): Promise<string> => new Promise((resolve, reject) => {
  const sockPath = bridgeListenPath(userDataPath, randomBytes(8).toString('hex'))
  if (process.platform !== 'win32') {
    fs.mkdirSync(path.dirname(sockPath), { recursive: true, mode: 0o700 })
  }
  const next = net.createServer(onConnection)
  const failListen = (error: Error): void => {
    opening = null
    reject(error)
  }
  next.on('error', failListen)
  next.listen(sockPath, () => {
    next.off('error', failListen)
    // listen creates the socket with the process umask; other users must not connect.
    if (process.platform !== 'win32') fs.chmodSync(sockPath, 0o600)
    next.on('error', (error) => {
      log.error(error)
    })
    server = next
    address = sockPath
    resolve(sockPath)
  })
})

/**
 * Local ndjson bridge for `reply_to_thread`. One server per process, started
 * on the first window that asks. A token names a window; the turn is whichever
 * one is current when the line arrives.
 *
 * `userDataPath` is `app.getPath('userData')`. Only the first call's path is used.
 */
export const bridgeForWindow = async(userDataPath: string, windowId: number): Promise<WindowBridge> => {
  if (!opening) opening = listen(userDataPath)
  const bound = address ?? await opening
  let token = tokensByWindow.get(windowId)
  if (!token) {
    token = randomBytes(32).toString('hex')
    tokensByWindow.set(windowId, token)
    tokens.set(token, windowId)
  }
  return { address: bound, token }
}

/** Drops the window's token. A later reply with it is `unknown token`. */
export const releaseWindowBridge = (windowId: number): void => {
  const token = tokensByWindow.get(windowId)
  if (!token) return
  tokensByWindow.delete(windowId)
  tokens.delete(token)
}

/** Stops the process server and forgets every token. Used by tests and shutdown. */
export const closeBridgeServer = async(): Promise<void> => {
  tokens.clear()
  tokensByWindow.clear()
  for (const socket of sockets) socket.destroy()
  sockets.clear()
  const current = server
  const sock = address
  server = null
  address = null
  opening = null
  if (current) {
    await new Promise<void>((resolve, reject) => {
      current.close((error) => error ? reject(error) : resolve())
    })
  }
  if (sock && process.platform !== 'win32') fs.rmSync(sock, { force: true })
}
