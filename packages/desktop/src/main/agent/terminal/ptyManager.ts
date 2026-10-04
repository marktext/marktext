import { spawn, type IDisposable, type IPty } from 'node-pty'
import { patchEnvPath } from '../../app/envPath'

/** Coalesce pty output so the renderer is not woken for every byte. */
export const PTY_FLUSH_MS = 16
const STOP_TIMEOUT_MS = 2_000

export class PtyManagerError extends Error {
  readonly code = 'no_repo' as const

  constructor(message = 'the window has no repository') {
    super(message)
    this.name = 'PtyManagerError'
  }
}

export interface PtyManagerDeps {
  /** `agentTerminalShell`. Empty means the platform default. */
  shellPreference(): unknown
  repoRoot(windowId: number): string | null
  newId(): string
  onData(windowId: number, termId: string, data: string): void
  onExit(windowId: number, termId: string, code: number | null): void
}

interface Session {
  windowId: number
  termId: string
  pty: IPty
  pending: string
  timer: ReturnType<typeof setTimeout> | null
  dataSub: IDisposable
  exitSub: IDisposable
  done: boolean
  settle: () => void
  stopped: Promise<void>
}

const dimension = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

/** Tab label: the program name, without the directory. */
export const shellBaseName = (shell: string): string => {
  const parts = shell.split(/[/\\]/)
  return parts[parts.length - 1] || shell
}

const defaultShell = (): string => {
  if (process.platform === 'win32') return 'powershell.exe'
  const shell = process.env.SHELL?.trim()
  return shell && shell.length > 0 ? shell : '/bin/bash'
}

const terminalEnv = (): Record<string, string> => {
  patchEnvPath()
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value
  }
  env.TERM = 'xterm-256color'
  return env
}

/**
 * One window may own several ptys. They all share the repository root as cwd
 * and die together when the window closes or the folder changes.
 */
export class PtyManager {
  private readonly sessions = new Map<string, Session>()
  private readonly byWindow = new Map<number, Set<string>>()

  constructor(private readonly deps: PtyManagerDeps) {}

  create(windowId: number, size: { cols: number, rows: number }): { termId: string, shell: string } {
    const root = this.deps.repoRoot(windowId)
    if (!root) throw new PtyManagerError()
    const configured = this.deps.shellPreference()
    const shell = typeof configured === 'string' && configured.trim().length > 0
      ? configured.trim()
      : defaultShell()
    const termId = this.deps.newId()
    const cols = dimension(size.cols, 80)
    const rows = dimension(size.rows, 24)
    const pty = spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: root,
      env: terminalEnv()
    })
    let settle = (): void => undefined
    const stopped = new Promise<void>((resolve) => {
      settle = resolve
    })
    const unused: IDisposable = { dispose() {} }
    const session: Session = {
      windowId,
      termId,
      pty,
      pending: '',
      timer: null,
      dataSub: unused,
      exitSub: unused,
      done: false,
      settle,
      stopped
    }
    session.dataSub = pty.onData((chunk) => {
      this.accept(session, chunk)
    })
    session.exitSub = pty.onExit((event) => {
      const code = typeof event.exitCode === 'number' ? event.exitCode : null
      this.finish(session, code)
    })
    this.sessions.set(termId, session)
    const ids = this.byWindow.get(windowId) ?? new Set<string>()
    ids.add(termId)
    this.byWindow.set(windowId, ids)
    return { termId, shell: shellBaseName(shell) }
  }

  input(windowId: number, termId: string, data: string): void {
    const session = this.sessionFor(windowId, termId)
    if (!session || session.done) return
    session.pty.write(data)
  }

  resize(windowId: number, termId: string, cols: number, rows: number): void {
    const session = this.sessionFor(windowId, termId)
    if (!session || session.done) return
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || rows < 1) return
    session.pty.resize(Math.floor(cols), Math.floor(rows))
  }

  kill(windowId: number, termId: string): void {
    const session = this.sessionFor(windowId, termId)
    if (!session || session.done) return
    this.stop(session)
  }

  async disposeWindow(windowId: number): Promise<void> {
    const ids = [...(this.byWindow.get(windowId) ?? [])]
    await Promise.all(ids.map((termId) => {
      const session = this.sessions.get(termId)
      if (!session) return Promise.resolve()
      this.stop(session)
      return Promise.race([
        session.stopped,
        new Promise<void>((resolve) => {
          setTimeout(resolve, STOP_TIMEOUT_MS)
        })
      ])
    }))
  }

  private sessionFor(windowId: number, termId: string): Session | null {
    const session = this.sessions.get(termId)
    if (!session || session.windowId !== windowId) return null
    return session
  }

  private accept(session: Session, chunk: string): void {
    if (session.done || chunk.length === 0) return
    session.pending += chunk
    if (session.timer) return
    session.timer = setTimeout(() => {
      session.timer = null
      this.flush(session)
    }, PTY_FLUSH_MS)
  }

  private flush(session: Session): void {
    if (session.pending.length === 0) return
    const data = session.pending
    session.pending = ''
    this.deps.onData(session.windowId, session.termId, data)
  }

  private stop(session: Session): void {
    try {
      session.pty.kill()
    } catch {
      this.finish(session, null)
    }
  }

  private finish(session: Session, code: number | null): void {
    if (session.done) return
    session.done = true
    session.dataSub.dispose()
    if (session.timer) clearTimeout(session.timer)
    session.timer = null
    this.flush(session)
    this.sessions.delete(session.termId)
    const ids = this.byWindow.get(session.windowId)
    ids?.delete(session.termId)
    if (ids && ids.size === 0) this.byWindow.delete(session.windowId)
    session.exitSub.dispose()
    this.deps.onExit(session.windowId, session.termId, code)
    session.settle()
  }
}
