import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PNG, restoreEnv, setPlatform, writeFakePicgo, writeFakeShell } from '../commandFixtures'

// #5518: a GUI-launched app inherits launchd's PATH, not the login shell's, so
// a picgo installed by pnpm/volta/nvm was invisible — the uploader panel said
// it was not installed and every upload failed. Here picgo exists only in a
// directory the login shell knows about, and both answers have to come back
// right.

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
  // Stands in for `~/Library/pnpm` — a real install location that no hardcoded
  // fallback list covers and that launchd never puts on PATH.
  const binDir = path.join(tmpDir, 'pnpm-home')
  await fs.ensureDir(binDir)
  await writeFakePicgo(binDir)
  const shell = await writeFakeShell(path.join(tmpDir, 'login-shell'), `${binDir}:/usr/bin:/bin`)

  originalPath = process.env.PATH
  originalShell = process.env.SHELL
  originalHome = process.env.HOME
  process.env.SHELL = shell
  process.env.PATH = '/usr/bin:/bin'
  // The stand-in has to be the only picgo reachable, or the upload test hands a
  // real image to whatever host the developer has configured. HOME alone is not
  // enough: the system half of the fallback dirs (/opt/homebrew/bin,
  // /usr/local/bin) ignores HOME. A platform with no system table leaves only
  // the dirs under this temp HOME — and exercises the BSD case while it is here.
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
