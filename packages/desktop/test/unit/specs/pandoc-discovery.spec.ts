import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreEnv, setPlatform, writeFakeShell } from '../commandFixtures'

// #2751 was the same gap as #5518, and pandoc kept its own resolver through it:
// a pandoc under nvm/asdf, which only the login shell knows about, was reported
// missing. It goes through resolveCommand now, so it sees what picgo sees.

const origPlatform = process.platform
const skipOnWindows = process.platform === 'win32'

let tmpDir: string
let binDir: string
let originalPath: string | undefined
let originalShell: string | undefined
let originalHome: string | undefined
let originalOverride: string | undefined

const loadPandoc = async() => {
  vi.resetModules()
  return (await import('main_renderer/utils/pandoc')).default
}

beforeAll(async() => {
  if (skipOnWindows) return
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-pandoc-discovery-'))
  binDir = path.join(tmpDir, 'asdf-shims')
  await fs.ensureDir(binDir)
  await fs.writeFile(path.join(binDir, 'pandoc'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })

  originalPath = process.env.PATH
  originalShell = process.env.SHELL
  originalHome = process.env.HOME
  originalOverride = process.env.MARKTEXT_PANDOC
})

beforeEach(() => {
  if (skipOnWindows) return
  // No shell, nothing on PATH, no override: each case opts into one difference.
  process.env.SHELL = '/usr/sbin/nologin'
  process.env.PATH = '/usr/bin:/bin'
  process.env.HOME = tmpDir
  delete process.env.MARKTEXT_PANDOC
  setPlatform('freebsd')
})

afterEach(() => {
  if (skipOnWindows) return
  setPlatform(origPlatform)
  restoreEnv('PATH', originalPath)
  restoreEnv('SHELL', originalShell)
  restoreEnv('HOME', originalHome)
  restoreEnv('MARKTEXT_PANDOC', originalOverride)
})

afterAll(async() => {
  if (skipOnWindows) return
  await fs.remove(tmpDir)
})

describe.skipIf(skipOnWindows)('pandoc discovery (#2751)', () => {
  it('remembers a hit, so one export does not resolve three times', async() => {
    process.env.PATH = `${binDir}:/usr/bin:/bin`

    const pandoc = await loadPandoc()
    await expect(pandoc.exists()).resolves.toBe(true)

    // Out of reach now — only a remembered answer can still say yes.
    process.env.PATH = '/usr/bin:/bin'
    await expect(pandoc.exists()).resolves.toBe(true)
  })

  it('asks again after a miss, so installing it does not need a restart', async() => {
    const pandoc = await loadPandoc()
    await expect(pandoc.exists()).resolves.toBe(false)

    process.env.PATH = `${binDir}:/usr/bin:/bin`
    await expect(pandoc.exists()).resolves.toBe(true)
  })

  it('finds a pandoc only the login shell knows about', async() => {
    process.env.SHELL = await writeFakeShell(
      path.join(tmpDir, 'login-shell'),
      `${binDir}:/usr/bin:/bin`
    )

    const pandoc = await loadPandoc()
    await expect(pandoc.exists()).resolves.toBe(true)
  })

  it('reports missing when no shell and no PATH entry has it', async() => {
    const pandoc = await loadPandoc()
    await expect(pandoc.exists()).resolves.toBe(false)
  })

  it('does not quietly run another pandoc when the override cannot', async() => {
    // A pandoc on PATH used to win here, so the setting was ignored and a
    // binary the user did not name ran instead.
    const notExecutable = path.join(tmpDir, 'pandoc-not-a-binary')
    await fs.writeFile(notExecutable, 'text\n', { mode: 0o644 })
    process.env.MARKTEXT_PANDOC = notExecutable
    process.env.PATH = `${binDir}:/usr/bin:/bin`

    const pandoc = await loadPandoc()
    await expect(pandoc.exists()).resolves.toBe(false)
  })
})
