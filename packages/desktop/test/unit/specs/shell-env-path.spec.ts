import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { restoreEnv, setPlatform, writeFakeShell } from '../commandFixtures'

const origPlatform = process.platform
const origPath = process.env.PATH
const origShell = process.env.SHELL

let tmpDir: string
let runLog: string

const fakeShell = (name: string, shellPath: string, before?: string[]) =>
  writeFakeShell(path.join(tmpDir, name), shellPath, { record: runLog, before })

const loadEnvPath = async() => {
  vi.resetModules()
  return import('main_renderer/app/envPath')
}

const pathDirs = (): string[] => (process.env.PATH ?? '').split(path.delimiter)

beforeAll(async() => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-shell-path-'))
  runLog = path.join(tmpDir, 'run.log')
})

afterAll(async() => {
  await fs.remove(tmpDir)
})

afterEach(async() => {
  setPlatform(origPlatform)
  restoreEnv('PATH', origPath)
  restoreEnv('SHELL', origShell)
  await fs.writeFile(runLog, '')
})

const skipOnWindows = process.platform === 'win32'

describe.skipIf(skipOnWindows)('ensureShellEnvPath (#5518)', () => {
  it('adds a bin dir only the login shell knows about', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await fakeShell('login-shell', `${toolDir}:/usr/bin:/bin`)
    process.env.PATH = '/usr/bin:/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(pathDirs()).toContain(toolDir)
  })

  it('puts the shell dirs in front, in the shell order, keeping the rest', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await fakeShell('login-shell', `${toolDir}:/usr/bin`)
    process.env.PATH = '/first:/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    const dirs = pathDirs()
    expect(dirs[0]).toBe(toolDir)
    expect(dirs).toContain('/first')
    expect(dirs.filter((d) => d === '/usr/bin')).toHaveLength(1)
  })

  it('outranks a static guess that names the same dir later', async() => {
    // A stale /opt/homebrew/bin/picgo must not shadow ~/Library/pnpm/picgo
    // here when it does not in the user's terminal.
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await fakeShell('login-shell', `${toolDir}:/usr/bin`)
    setPlatform('darwin')
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath, patchEnvPath } = await loadEnvPath()
    patchEnvPath()
    await ensureShellEnvPath()

    const dirs = pathDirs()
    expect(dirs.indexOf(toolDir)).toBeLessThan(dirs.indexOf('/opt/homebrew/bin'))
  })

  it('ignores output that was cut off before the closing marker', async() => {
    // What a maxBuffer truncation or a killed shell leaves behind.
    const file = path.join(tmpDir, 'truncated-shell')
    await fs.writeFile(file, '#!/bin/sh\nprintf \'__MARKTEXT_PATH_BEGIN__\\n/half\'\n', {
      mode: 0o755
    })
    process.env.SHELL = file
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(process.env.PATH).toBe('/usr/bin')
  })

  it('steps over what a per-command hook prints inside the fence', async() => {
    // p10k's instant prompt and friends land between the marker and the PATH.
    const toolDir = path.join(tmpDir, 'hooked-home')
    const file = path.join(tmpDir, 'hooked-shell')
    await fs.writeFile(
      file,
      [
        '#!/bin/sh',
        "printf '__MARKTEXT_PATH_BEGIN__\\n'",
        "printf 'p10k: instant prompt active\\n'",
        `printf '${toolDir}:/usr/bin\\n'`,
        "printf '__MARKTEXT_PATH_END__\\n'"
      ].join('\n') + '\n',
      { mode: 0o755 }
    )
    process.env.SHELL = file
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(pathDirs()).toContain(toolDir)
  })

  it('lets a later caller retry after a run that could not be read', async() => {
    // A shell that timed out on a busy machine answers fine a moment later.
    const flag = path.join(tmpDir, 'first-run-done')
    const toolDir = path.join(tmpDir, 'retry-home')
    const file = path.join(tmpDir, 'flaky-shell')
    await fs.writeFile(
      file,
      [
        '#!/bin/sh',
        `if [ ! -f "${flag}" ]; then : > "${flag}"; exit 1; fi`,
        'for a in "$@"; do last="$a"; done',
        `PATH="${toolDir}:/usr/bin" /bin/sh -c "$last"`
      ].join('\n') + '\n',
      { mode: 0o755 }
    )
    process.env.SHELL = file
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()
    expect(pathDirs(), 'first run failed, so nothing was added').not.toContain(toolDir)

    await ensureShellEnvPath()
    expect(pathDirs()).toContain(toolDir)
  })

  it('runs the login shell once however many callers ask', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await fakeShell('login-shell', `${toolDir}:/usr/bin`)
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await Promise.all([ensureShellEnvPath(), ensureShellEnvPath()])
    await ensureShellEnvPath()

    const runs = (await fs.readFile(runLog, 'utf8')).split('\n').filter(Boolean)
    expect(runs).toHaveLength(1)
  })

  it('reads the PATH out of a shell whose startup files print a banner', async() => {
    const toolDir = path.join(tmpDir, 'noisy-home')
    process.env.SHELL = await fakeShell('noisy-shell', `${toolDir}:/usr/bin`, [
      "printf 'Welcome to your shell\\n'",
      "printf 'motd on stderr\\n' >&2"
    ])
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(pathDirs()).toContain(toolDir)
  })

  it('leaves PATH untouched when the login shell fails', async() => {
    const file = path.join(tmpDir, 'broken-shell')
    await fs.writeFile(file, '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    process.env.SHELL = file
    process.env.PATH = '/usr/bin:/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(process.env.PATH).toBe('/usr/bin:/bin')
  })

  it('does not spawn a login shell that cannot run commands', async() => {
    process.env.SHELL = '/usr/sbin/nologin'
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await expect(ensureShellEnvPath()).resolves.toBeUndefined()
    expect(process.env.PATH).toBe('/usr/bin')
  })

  it('ignores a relative dir the shell reported', async() => {
    process.env.SHELL = await fakeShell('relative-shell', './node_modules/.bin:/usr/bin')
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(pathDirs()).not.toContain('./node_modules/.bin')
  })
})

describe('ensureShellEnvPath on win32', () => {
  it('leaves PATH untouched', async() => {
    setPlatform('win32')
    process.env.PATH = 'C:\\Windows'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(process.env.PATH).toBe('C:\\Windows')
  })
})
