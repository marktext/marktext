import path from 'path'
import { userInfo } from 'os'
import { spawn } from 'child_process'

// A GUI-launched app inherits launchd's PATH, not the login shell's, so the
// user's own CLI tools are unreachable (#5518, #2751). `patchEnvPath` is sync
// and covers everything reading process.env.PATH; `ensureShellEnvPath` must be
// awaited, so only `resolveCommand` benefits from it.
const SYSTEM_BIN_DIRS: Record<string, string[]> = {
  darwin: [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/local/lib/node_modules/.bin',
    '/usr/bin',
    '/bin',
    '/Library/TeX/texbin'
  ],
  linux: ['/usr/local/bin', '/usr/local/lib/node_modules/.bin', '/usr/bin', '/bin']
}

// A `pnpm add -g picgo` lands in exactly one of these, which no system dir
// covers and launchd never puts on PATH.
const userBinDirs = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => {
  const home = env.HOME
  if (!home) return []
  return [
    platform === 'darwin'
      ? path.join(home, 'Library', 'pnpm')
      : path.join(home, '.local', 'share', 'pnpm'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.volta', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.yarn', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.npm', 'bin')
  ]
}

// Windows GUI apps do start with the user's own PATH, so there is nothing to
// repair — but a package manager's shim dir is not on it to begin with.
const windowsShimDirs = (env: NodeJS.ProcessEnv): string[] =>
  [
    env.ProgramData && path.join(env.ProgramData, 'chocolatey', 'bin'),
    env.USERPROFILE && path.join(env.USERPROFILE, 'scoop', 'shims'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links')
  ].filter((dir): dir is string => !!dir)

/** The arguments let a spec pin both. */
export const extraPathDirs = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => {
  if (platform === 'win32') return [...new Set(windowsShimDirs(env))]
  // Keyed off win32 rather than off this table, or the BSDs would get no
  // fallback at all while still paying for the shell spawn.
  const system = SYSTEM_BIN_DIRS[platform] ?? []
  // Routinely a dir already listed, and npm leaves a `~/…` prefix unexpanded.
  const npmPrefix = env.npm_config_prefix ? [path.join(env.npm_config_prefix, 'bin')] : []
  const dirs = [...system, ...userBinDirs(platform, env), ...npmPrefix]
  return [...new Set(dirs.filter((dir) => path.isAbsolute(dir)))]
}

const splitEnvPath = (): string[] => (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)

/** Static guesses rank below what the launcher provided. */
const appendToEnvPath = (dirs: string[]): void => {
  // An empty merge must leave PATH byte-identical, not normalised.
  if (!dirs.length) return
  const current = splitEnvPath()
  for (const dir of dirs) {
    if (!current.includes(dir)) current.push(dir)
  }
  process.env.PATH = current.join(path.delimiter)
}

/**
 * The shell's own order wins, including over dirs the static guesses already
 * appended: a stale `/opt/homebrew/bin/picgo` shadowing a working
 * `~/Library/pnpm/picgo` must not out-rank it here when it does not in the
 * user's terminal.
 */
const prependToEnvPath = (dirs: string[]): void => {
  if (!dirs.length) return
  const rest = splitEnvPath().filter((dir) => !dirs.includes(dir))
  process.env.PATH = [...dirs, ...rest].join(path.delimiter)
}

export const patchEnvPath = (): void => {
  appendToEnvPath(extraPathDirs(process.platform, process.env))
}

// No static list can guess where nvm/fnm/asdf put a node's global bins, so the
// login shell is asked. `printenv` rather than `echo $PATH`, which fish prints
// space-separated. The value is fenced because startup files and per-command
// hooks print freely around it; the closing marker doubles as proof that the
// output was not cut short.
const BEGIN_MARKER = '__MARKTEXT_PATH_BEGIN__'
const END_MARKER = '__MARKTEXT_PATH_END__'
const SHELL_COMMAND = `echo ${BEGIN_MARKER}; printenv PATH; echo ${END_MARKER}`
const SHELL_TIMEOUT = 5000
// Node's 1MB default is within reach of a chatty startup file.
const SHELL_MAX_BUFFER = 8 * 1024 * 1024

const loginShell = (): string | null => {
  let shell = process.env.SHELL
  if (!shell) {
    try {
      shell = userInfo().shell ?? undefined
    } catch {
      /* no passwd entry for this uid */
    }
  }
  if (!shell || !path.isAbsolute(shell)) return null
  return /\/(nologin|false)$/.test(shell) ? null : shell
}

/** null when the shell could not be read this time; [] when it reported none. */
const parseShellPath = (stdout: string): string[] | null => {
  const begin = stdout.lastIndexOf(BEGIN_MARKER)
  if (begin < 0) return null
  const end = stdout.indexOf(END_MARKER, begin)
  if (end < 0) return null
  const fenced = stdout.slice(begin + BEGIN_MARKER.length, end)
  for (const line of fenced.split(/\r?\n/)) {
    const dirs = line.trim().split(path.delimiter).filter((dir) => path.isAbsolute(dir))
    if (dirs.length) return dirs
  }
  return []
}

const readLoginShellPath = (shell: string): Promise<string[] | null> =>
  new Promise((resolve) => {
    // Own process group, so the timeout can take whatever the rc file
    // backgrounded with it. Inherited stdin would make an interactive shell
    // wait on it.
    const child = spawn(shell, ['-ilc', SHELL_COMMAND], {
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })

    let settled = false
    const finish = (value: string[] | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
      resolve(value)
    }

    const timer = setTimeout(() => finish(parseShellPath(stdout)), SHELL_TIMEOUT)

    let stdout = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < SHELL_MAX_BUFFER) stdout += chunk
      // A backgrounded job inherits this pipe and holds `close` open behind it,
      // so waiting for exit would cost the full timeout on those setups.
      if (stdout.includes(END_MARKER)) finish(parseShellPath(stdout))
    })

    child.on('error', () => finish(null))
    child.on('close', () => finish(parseShellPath(stdout)))
  })

const importShellEnvPath = async(): Promise<boolean> => {
  if (process.platform === 'win32') return true
  const shell = loginShell()
  if (!shell) return true
  const dirs = await readLoginShellPath(shell)
  if (!dirs) return false
  prependToEnvPath(dirs)
  return true
}

let shellEnvPath: Promise<boolean> | undefined
let attempts = 0
const MAX_ATTEMPTS = 3

/**
 * Resolves once the login shell's dirs are in front on this process's PATH.
 * The shell is spawned once per run; a read that failed is retried by the next
 * caller, since a shell that timed out on a busy machine answers fine later.
 */
export const ensureShellEnvPath = async(): Promise<void> => {
  if (!shellEnvPath) {
    if (attempts >= MAX_ATTEMPTS) return
    attempts += 1
    shellEnvPath = importShellEnvPath()
  }
  if (!(await shellEnvPath)) shellEnvPath = undefined
}
