import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveCommand } from 'main_renderer/utils/resolveCommand'
import { restoreEnv } from '../commandFixtures'

// The fallback dirs are reached through HOME, so pointing HOME at a temp dir
// puts the developer's real tools out of reach and makes this deterministic.
let home: string
let binDir: string
let originalHome: string | undefined
let originalPath: string | undefined
let originalShell: string | undefined

const skipOnWindows = process.platform === 'win32'

beforeAll(async() => {
  if (skipOnWindows) return
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-resolve-'))
  binDir = path.join(home, '.local', 'bin')
  await fs.ensureDir(binDir)
  originalHome = process.env.HOME
  originalPath = process.env.PATH
  originalShell = process.env.SHELL
  process.env.HOME = home
  process.env.PATH = '/usr/bin:/bin'
  // No login shell to consult, so a miss stays a miss instead of costing a
  // spawn — these cases are about the fallback dirs alone.
  process.env.SHELL = '/usr/sbin/nologin'
})

afterAll(async() => {
  if (skipOnWindows) return
  restoreEnv('HOME', originalHome)
  restoreEnv('SHELL', originalShell)
  restoreEnv('PATH', originalPath)
  await fs.remove(home)
})

describe.skipIf(skipOnWindows)('resolveCommand fallback dirs (#5518)', () => {
  it('finds an executable that only a fallback dir carries', async() => {
    const file = path.join(binDir, 'mt-fallback-tool')
    await fs.writeFile(file, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    await expect(resolveCommand('mt-fallback-tool')).resolves.toBe(file)
  })

  it('ignores a file it could not run', async() => {
    // A PATH lookup answers "no such command" for this, so the fallback has to
    // agree — otherwise the check passes and the spawn fails with EACCES.
    await fs.writeFile(path.join(binDir, 'mt-not-executable'), 'data\n', { mode: 0o644 })
    await expect(resolveCommand('mt-not-executable')).resolves.toBeNull()
  })

  it('ignores a directory that happens to bear the name', async() => {
    await fs.ensureDir(path.join(binDir, 'mt-a-directory'))
    await expect(resolveCommand('mt-a-directory')).resolves.toBeNull()
  })

  it('answers null for a command nobody installed', async() => {
    await expect(resolveCommand('mt-no-such-command-5518')).resolves.toBeNull()
  })

  it('answers null for an empty name, which a PATH lookup calls present', async() => {
    await expect(resolveCommand('')).resolves.toBeNull()
    await expect(resolveCommand('   ')).resolves.toBeNull()
  })

  it('refuses a name that would walk out of the dirs it searches', async() => {
    // `path.join('/usr/local/bin', '../../bin/sh')` is a real executable, and
    // returning it would break the promise that the answer sits in a bin dir
    // this function searched. The name comes from the renderer over IPC.
    await expect(resolveCommand('../../bin/sh')).resolves.toBeNull()
    await expect(resolveCommand('../bin/ls')).resolves.toBeNull()
    await expect(resolveCommand('/bin/sh')).resolves.toBeNull()
  })
})
