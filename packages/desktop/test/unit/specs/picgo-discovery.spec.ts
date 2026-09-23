import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PNG, restoreEnv, setPlatform, writeFakePicgo, writeFakeShell } from '../commandFixtures'

// #5518. picgo exists only in a dir the login shell knows about, and both the
// detection and the upload have to find it.

type Handler = (event: unknown, req: unknown) => Promise<unknown>
const handlers = new Map<string, Handler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn)
  }
}))

const skipOnWindows = process.platform === 'win32'
const origPlatform = process.platform

let tmpDir: string
let originalPath: string | undefined
let originalShell: string | undefined
let originalHome: string | undefined

beforeAll(async() => {
  if (skipOnWindows) return

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-picgo-discovery-'))
  // Stands in for ~/Library/pnpm.
  const binDir = path.join(tmpDir, 'pnpm-home')
  await fs.ensureDir(binDir)
  await writeFakePicgo(binDir)
  const shell = await writeFakeShell(path.join(tmpDir, 'login-shell'), `${binDir}:/usr/bin:/bin`)

  originalPath = process.env.PATH
  originalShell = process.env.SHELL
  originalHome = process.env.HOME
  process.env.SHELL = shell
  process.env.PATH = '/usr/bin:/bin'
  // The stand-in must be the only picgo reachable, or the upload test hands a
  // real image to the developer's own host. HOME alone is not enough — the
  // system dirs ignore it — so pick a platform with no system table.
  process.env.HOME = tmpDir
  setPlatform('freebsd')

  const { registerCmdHandlers } = await import('main_renderer/ipc/cmd')
  const { registerUploaderHandlers } = await import('main_renderer/ipc/uploader')
  registerCmdHandlers()
  registerUploaderHandlers()
})

afterAll(async() => {
  if (skipOnWindows) return
  setPlatform(origPlatform)
  restoreEnv('PATH', originalPath)
  restoreEnv('SHELL', originalShell)
  restoreEnv('HOME', originalHome)
  await fs.remove(tmpDir)
})

const call = async(channel: string, req: unknown) => {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`${channel} was never registered`)
  return handler(null, req)
}

describe.skipIf(skipOnWindows)('picgo found through the login shell (#5518)', () => {
  it('reports picgo as installed', async() => {
    await expect(call('mt::cmd::exists', 'picgo')).resolves.toBe(true)
  })

  it('uploads with the very same picgo the check found', async() => {
    const url = await call('mt::uploader::upload', {
      pathname: '/tmp/notes/a.md',
      image: { data: new Uint8Array(PNG), name: 'image.png' },
      isPath: false,
      preferences: { currentUploader: 'picgo', cliScript: '' }
    })

    expect(url).toBe('https://cdn.example.com/uploaded.png')
  })
})
