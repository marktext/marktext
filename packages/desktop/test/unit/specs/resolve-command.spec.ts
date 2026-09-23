import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveCommand } from 'main_renderer/utils/resolveCommand'
import { restoreEnv } from '../commandFixtures'

// The fallback dirs hang off HOME, so a temp HOME puts the developer's own
// tools out of reach.
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
  // No shell to consult: these cases are about the fallback dirs alone.
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
    // A PATH lookup says "no such command" here, so the fallback must agree.
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

  it('takes a preferred location over anything on PATH', async() => {
    // What an installer writes outside PATH, and what MARKTEXT_PANDOC names.
    const preferred = path.join(home, 'Preferred', 'ls')
    await fs.ensureDir(path.dirname(preferred))
    await fs.writeFile(preferred, '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    await expect(resolveCommand('ls')).resolves.toBe('ls')
    await expect(resolveCommand('ls', { preferred: [preferred] })).resolves.toBe(preferred)
  })

  it('skips a preferred location it could not run', async() => {
    const notExecutable = path.join(home, 'Preferred', 'mt-unrunnable')
    await fs.writeFile(notExecutable, 'data\n', { mode: 0o644 })

    const options = { preferred: [notExecutable, '/no/such/file'] }
    await expect(resolveCommand('mt-nothing-5518', options)).resolves.toBeNull()
  })

  it('falls back to PATH when no preferred location exists', async() => {
    await expect(resolveCommand('ls', { preferred: ['/no/such/file'] })).resolves.toBe('ls')
  })

  it('takes an override as an instruction, not as one more guess', async() => {
    // Falling through to another copy would run something the user did not ask
    // for, and report success while their setting is quietly ignored.
    const unusable = path.join(home, 'Preferred', 'mt-bad-override')
    await fs.ensureDir(path.dirname(unusable))
    await fs.writeFile(unusable, 'data\n', { mode: 0o644 })

    await expect(resolveCommand('ls', { override: unusable })).resolves.toBeNull()
    await expect(resolveCommand('ls', { override: '/no/such/file' })).resolves.toBeNull()
  })

  it('uses an override that can run', async() => {
    const usable = path.join(home, 'Preferred', 'mt-good-override')
    await fs.ensureDir(path.dirname(usable))
    await fs.writeFile(usable, '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    await expect(resolveCommand('ls', { override: usable })).resolves.toBe(usable)
  })

  it('refuses a name that would walk out of the dirs it searches', async() => {
    // These join their way to a real executable outside every dir searched.
    await expect(resolveCommand('../../bin/sh')).resolves.toBeNull()
    await expect(resolveCommand('../bin/ls')).resolves.toBeNull()
    await expect(resolveCommand('/bin/sh')).resolves.toBeNull()
  })
})
