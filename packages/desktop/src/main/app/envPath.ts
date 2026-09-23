import path from 'path'
import { userInfo } from 'os'
import { execFile } from 'child_process'

// GUI-launched apps on macOS/Linux don't inherit the user's login-shell PATH,
// so CLI tools the user installed are unreachable: pandoc could not be found
// (#2751), and picgo was reported as not installed and refused to upload
// (#5518). Two layers answer that: the static dirs below, and the login shell
// itself (`ensureShellEnvPath`).
const SYSTEM_BIN_DIRS: Record<string, string[]> = {
  darwin: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/Library/TeX/texbin'],
  linux: ['/usr/local/bin', '/usr/bin', '/bin']
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
  const system = SYSTEM_BIN_DIRS[platform]
  if (!system) return []
  // The configured npm prefix is routinely one of the dirs already listed —
  // `~/.npm-global`, `/usr/local` and `/opt/homebrew` are its three common
  // values. It can also be a literal `~/…` that nothing expanded, which is not
  // a dir this process can look in.
  const npmPrefix = env.npm_config_prefix ? [path.join(env.npm_config_prefix, 'bin')] : []
  const dirs = [...system, ...userBinDirs(platform, env), ...npmPrefix]
  return [...new Set(dirs.filter((dir) => path.isAbsolute(dir)))]
}

const appendToEnvPath = (dirs: string[]): void => {
  const current = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    if (!current.includes(dir)) current.push(dir)
  }
  process.env.PATH = current.join(path.delimiter)
}

export const patchEnvPath = (): void => {
  const extras = extraPathDirs(process.platform, process.env)
  if (extras.length) appendToEnvPath(extras)
}

// The list above can only hold the install locations that sit at a fixed path.
// A node managed by nvm/fnm/asdf puts its global bins under a version number no
// list can guess, so the login shell is asked where they are. The marker lets
// the answer be picked out of whatever a startup file printed first, and
// `printenv` is used rather than `echo $PATH` because fish would print its PATH
// space-separated.
const PATH_MARKER = '__MARKTEXT_PATH__'
const SHELL_TIMEOUT = 5000

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

const readLoginShellPath = (shell: string): Promise<string[]> =>
  new Promise((resolve) => {
    const child = execFile(
      shell,
      ['-ilc', `echo ${PATH_MARKER}; printenv PATH`],
      { timeout: SHELL_TIMEOUT, encoding: 'utf8' },
      (error, stdout) => {
        if (error && !stdout) return resolve([])
        const lines = String(stdout).split(/\r?\n/)
        let marker = -1
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          if (lines[i].includes(PATH_MARKER)) {
            marker = i
            break
          }
        }
        if (marker < 0) return resolve([])
        const reported = lines.slice(marker + 1).find((line) => line.trim().length > 0) ?? ''
        resolve(reported.trim().split(path.delimiter).filter((dir) => path.isAbsolute(dir)))
      }
    )
    // An interactive shell handed an open stdin can sit there waiting on it.
    child.stdin?.end()
  })

const importShellEnvPath = async(): Promise<void> => {
  if (process.platform === 'win32') return
  const shell = loginShell()
  if (!shell) return
  const dirs = await readLoginShellPath(shell)
  if (dirs.length) appendToEnvPath(dirs)
}

let shellEnvPath: Promise<void> | null = null

/**
 * Resolves once the login shell's PATH has been merged into this process's.
 * The shell is spawned at most once per run — it costs half a second on a
 * normal setup — and every caller after the first awaits that same answer.
 * Anything that looks for a user-installed command should await this first.
 */
export const ensureShellEnvPath = (): Promise<void> => {
  shellEnvPath ??= importShellEnvPath()
  return shellEnvPath
}
