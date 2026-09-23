import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const origPlatform = process.platform
const origPath = process.env.PATH
const origShell = process.env.SHELL

const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true })
}

let tmpDir: string
let runLog: string

// A stand-in for the user's login shell. It records that it ran, then evaluates
// the command it was handed with a PATH the GUI process never sees — which is
// the situation this import exists for.
const writeFakeShell = async(name: string, shellPath: string, before: string[] = []) => {
  const file = path.join(tmpDir, name)
  await fs.writeFile(
    file,
    [
      '#!/bin/sh',
      `printf 'ran\\n' >> "${runLog}"`,
      ...before,
      'for a in "$@"; do last="$a"; done',
      `PATH="${shellPath}" /bin/sh -c "$last"`
    ].join('\n') + '\n',
    { mode: 0o755 }
  )
  return file
}

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
  process.env.PATH = origPath
  if (origShell === undefined) delete process.env.SHELL
  else process.env.SHELL = origShell
  await fs.writeFile(runLog, '')
})

const skipOnWindows = process.platform === 'win32'

describe.skipIf(skipOnWindows)('ensureShellEnvPath (#5518)', () => {
  it('adds a bin dir only the login shell knows about', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await writeFakeShell('login-shell', `${toolDir}:/usr/bin:/bin`)
    process.env.PATH = '/usr/bin:/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    expect(pathDirs()).toContain(toolDir)
  })

  it('keeps the dirs the process already had, in their original order', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await writeFakeShell('login-shell', `${toolDir}:/usr/bin`)
    process.env.PATH = '/first:/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await ensureShellEnvPath()

    const dirs = pathDirs()
    expect(dirs[0]).toBe('/first')
    expect(dirs.filter((d) => d === '/usr/bin')).toHaveLength(1)
  })

  it('runs the login shell once however many callers ask', async() => {
    const toolDir = path.join(tmpDir, 'pnpm-home')
    process.env.SHELL = await writeFakeShell('login-shell', `${toolDir}:/usr/bin`)
    process.env.PATH = '/usr/bin'

    const { ensureShellEnvPath } = await loadEnvPath()
    await Promise.all([ensureShellEnvPath(), ensureShellEnvPath()])
    await ensureShellEnvPath()

    const runs = (await fs.readFile(runLog, 'utf8')).split('\n').filter(Boolean)
    expect(runs).toHaveLength(1)
  })

  it('reads the PATH out of a shell whose startup files print a banner', async() => {
    const toolDir = path.join(tmpDir, 'noisy-home')
    process.env.SHELL = await writeFakeShell('noisy-shell', `${toolDir}:/usr/bin`, [
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
    process.env.SHELL = await writeFakeShell('relative-shell', './node_modules/.bin:/usr/bin')
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
