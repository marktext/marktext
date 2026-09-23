import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveCommandPath } from 'main_renderer/utils/resolveCommand'

// The fallback dirs are reached through HOME, so pointing HOME at a temp dir
// puts the developer's real tools out of reach and makes this deterministic.
let home: string
let binDir: string
let originalHome: string | undefined
let originalPath: string | undefined

const skipOnWindows = process.platform === 'win32'

beforeAll(async() => {
  if (skipOnWindows) return
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-resolve-'))
  binDir = path.join(home, '.local', 'bin')
  await fs.ensureDir(binDir)
  originalHome = process.env.HOME
  originalPath = process.env.PATH
  process.env.HOME = home
  process.env.PATH = '/usr/bin:/bin'
})

afterAll(async() => {
  if (skipOnWindows) return
  if (originalHome === undefined) delete process.env.HOME
  else process.env.HOME = originalHome
  process.env.PATH = originalPath
  await fs.remove(home)
})

describe.skipIf(skipOnWindows)('resolveCommandPath fallback dirs (#5518)', () => {
  it('finds an executable that only a fallback dir carries', async() => {
    const file = path.join(binDir, 'mt-fallback-tool')
    await fs.writeFile(file, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    expect(resolveCommandPath('mt-fallback-tool')).toBe(file)
  })

  it('ignores a file it could not run', async() => {
    // A PATH lookup answers "no such command" for this, so the fallback has to
    // agree — otherwise the check passes and the spawn fails with EACCES.
    await fs.writeFile(path.join(binDir, 'mt-not-executable'), 'data\n', { mode: 0o644 })
    expect(resolveCommandPath('mt-not-executable')).toBeNull()
  })

  it('ignores a directory that happens to bear the name', async() => {
    await fs.ensureDir(path.join(binDir, 'mt-a-directory'))
    expect(resolveCommandPath('mt-a-directory')).toBeNull()
  })

  it('answers null for a command nobody installed', () => {
    expect(resolveCommandPath('mt-no-such-command-5518')).toBeNull()
  })
})
