import path from 'path'
import { userInfo } from 'os'
import { spawn } from 'child_process'

// GUI-launched apps on macOS/Linux don't inherit the user's login-shell PATH,
// so CLI tools the user installed are unreachable — picgo was reported as not
// installed and refused to upload (#5518). Two layers answer that, and they
// cover different callers: `patchEnvPath` below is synchronous and runs at
// startup, so everything reading `process.env.PATH` gets it (pandoc's own
// lookup included, #2751); `ensureShellEnvPath` has to be awaited, so only
// what goes through `resolveCommand` benefits from it.
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

// Where a user-level package manager drops the global bins it installs. A
// `pnpm add -g picgo` lands in exactly one of these, which no system dir covers
// and launchd never puts on PATH.
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

/**
 * Bin dirs to add to a PATH that came from a desktop launcher, deduplicated and
 * absolute. Empty on Windows, whose GUI apps are started with the user's own
 * environment. The arguments let a spec pin both.
 */
export const extraPathDirs = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => {
  if (platform === 'win32') return []
  // A platform with no system table still has a home dir: keying the user-level
  // dirs off the table would silently leave the BSDs with no fallback at all,
  // while still paying for the shell spawn below.
  const system = SYSTEM_BIN_DIRS[platform] ?? []
  // The configured npm prefix is routinely one of the dirs already listed —
  // `~/.npm-global`, `/usr/local` and `/opt/homebrew` are its three common
  // values. It can also be a literal `~/…` that nothing expanded, which is not
  // a dir this process can look in.
  const npmPrefix = env.npm_config_prefix ? [path.join(env.npm_config_prefix, 'bin')] : []
  const dirs = [...system, ...userBinDirs(platform, env), ...npmPrefix]
  return [...new Set(dirs.filter((dir) => path.isAbsolute(dir)))]
}

const splitEnvPath = (): string[] => (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)

/** Static guesses are the least authoritative thing we have, so they go last. */
const appendToEnvPath = (dirs: string[]): void => {
  // Rewriting PATH with nothing to add would still normalise it, and a spec
  // pins that an untouched platform leaves it byte-identical.
  if (!dirs.length) return
  const current = splitEnvPath()
  for (const dir of dirs) {
    if (!current.includes(dir)) current.push(dir)
  }
  process.env.PATH = current.join(path.delimiter)
}

/**
 * The login shell's own order, in front of everything else — including any of
 * these dirs the static guesses already appended. Resolving a command has to
 * land on the binary the user's terminal lands on: someone whose stale
 * `/opt/homebrew/bin/picgo` shadows a working `~/Library/pnpm/picgo` would
 * otherwise get a green check and an upload that fails.
 */
const prependToEnvPath = (dirs: string[]): void => {
  if (!dirs.length) return
  const rest = splitEnvPath().filter((dir) => !dirs.includes(dir))
  process.env.PATH = [...dirs, ...rest].join(path.delimiter)
}

export const patchEnvPath = (): void => {
  appendToEnvPath(extraPathDirs(process.platform, process.env))
}

// The list above can only hold the install locations that sit at a fixed path.
// A node managed by nvm/fnm/asdf puts its global bins under a version number no
// list can guess, so the login shell is asked where they are. `printenv` is
// used rather than `echo $PATH` because fish would print its PATH
// space-separated.
//
// The value is fenced between two markers: an interactive shell's startup files
// and per-command hooks print freely, both before the command and between its
// parts, and the closing marker is also what proves the output was not
// truncated.
const BEGIN_MARKER = '__MARKTEXT_PATH_BEGIN__'
const END_MARKER = '__MARKTEXT_PATH_END__'
const SHELL_COMMAND = `echo ${BEGIN_MARKER}; printenv PATH; echo ${END_MARKER}`
const SHELL_TIMEOUT = 5000
// A chatty startup file (a long motd, a `figlet` banner, a verbose bootstrap)
// can push the markers past node's 1MB default, where the import would fail
// with nothing to show for it.
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
  // An account logged in with `nologin`/`false` has no shell to report a PATH.
  return /\/(nologin|false)$/.test(shell) ? null : shell
}

/** The PATH the shell reported, or null when it could not be read this time. */
const parseShellPath = (stdout: string): string[] | null => {
  const begin = stdout.lastIndexOf(BEGIN_MARKER)
  if (begin < 0) return null
  const end = stdout.indexOf(END_MARKER, begin)
  // No closing marker means the run was cut short — truncated by maxBuffer or
  // killed by the timeout — and half a PATH is worse than none.
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
    // `detached` puts the shell in its own process group so the timeout below
    // can take the whole group with it: rc files routinely background things
    // (`(ssh-agent &)`, an update check) that would otherwise outlive the app,
    // once per launch. stdin is closed rather than inherited, or an interactive
    // shell sits waiting on it; stderr is dropped because a motd is not ours to
    // print.
    const child = spawn(shell, ['-ilc', SHELL_COMMAND], {
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })

    const endGroup = () => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    }

    let settled = false
    const finish = (value: string[] | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      endGroup()
      resolve(value)
    }

    const timer = setTimeout(() => finish(parseShellPath(stdout)), SHELL_TIMEOUT)

    let stdout = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      // A chatty startup file must not be able to grow this without bound. The
      // markers come last, so a run that overflows simply fails to parse.
      if (stdout.length < SHELL_MAX_BUFFER) stdout += chunk
      // Anything the rc file backgrounded inherits this pipe and holds `close`
      // open behind it, so waiting for the shell to exit would cost the full
      // timeout on those setups. The closing marker is the real end of what we
      // came for.
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
// A shell that timed out because the machine was busy at launch can answer on a
// later try, and the preferences panel re-asks every 30s — but a shell that is
// reliably unreadable should not be respawned forever.
const MAX_ATTEMPTS = 3

/**
 * Resolves once the dirs the login shell reports are in front on this process's
 * PATH. The shell is spawned at most once per run when it answers (half a
 * second on a normal setup); a run that could not be read is retried by the
 * next caller, up to a few times.
 */
export const ensureShellEnvPath = async(): Promise<void> => {
  if (!shellEnvPath) {
    if (attempts >= MAX_ATTEMPTS) return
    attempts += 1
    shellEnvPath = importShellEnvPath()
  }
  if (!(await shellEnvPath)) shellEnvPath = undefined
}
