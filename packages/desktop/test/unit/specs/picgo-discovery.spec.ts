import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// #5518: a GUI-launched app inherits launchd's PATH, not the login shell's, so
// a picgo installed by pnpm/volta/nvm is invisible — the uploader panel says it
// is not installed and every upload rejects. Both answers have to come back
// right once the login shell has been asked where the user's bins are.

type Handler = (event: unknown, req: unknown) => Promise<unknown>
const handlers = new Map<string, Handler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn)
  }
}))

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const skipOnWindows = process.platform === 'win32'

let tmpDir: string
let binDir: string
let originalPath: string | undefined
let originalShell: string | undefined

beforeAll(async() => {
  if (skipOnWindows) return

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-picgo-discovery-'))
  // Stands in for `~/Library/pnpm` — a real install location that no hardcoded
  // fallback list covers and that launchd never puts on PATH.
  binDir = path.join(tmpDir, 'pnpm-home')
  await fs.ensureDir(binDir)
  await fs.writeFile(
    path.join(binDir, 'picgo'),
    ['#!/bin/sh', 'echo "[PicGo SUCCESS]: "', 'echo "https://cdn.example.com/uploaded.png"'].join(
      '\n'
    ) + '\n',
    { mode: 0o755 }
  )

  const shell = path.join(tmpDir, 'login-shell')
  await fs.writeFile(
    shell,
    [
      '#!/bin/sh',
      'for a in "$@"; do last="$a"; done',
      `PATH="${binDir}:/usr/bin:/bin" /bin/sh -c "$last"`
    ].join('\n') + '\n',
    { mode: 0o755 }
  )

  originalPath = process.env.PATH
  originalShell = process.env.SHELL
  process.env.SHELL = shell
  process.env.PATH = '/usr/bin:/bin'

  const { registerCmdHandlers } = await import('main_renderer/ipc/cmd')
  const { registerUploaderHandlers } = await import('main_renderer/ipc/uploader')
  registerCmdHandlers()
  registerUploaderHandlers()
})

afterAll(async() => {
  if (skipOnWindows) return
  process.env.PATH = originalPath
  if (originalShell === undefined) delete process.env.SHELL
  else process.env.SHELL = originalShell
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

  it('still answers false for a command nobody installed', async() => {
    await expect(call('mt::cmd::exists', 'mt-no-such-command')).resolves.toBe(false)
  })
})
