import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Atomic saves unlink a path moments before recreating it (chokidar#591), and
// on Linux a delayed `unlink` can even arrive after the matching `add` already
// reloaded the tab. A deletion event must only reach the renderer when the
// path is still gone, otherwise the buffer is wrongly marked dirty and a stale
// "removed on disk" banner shows. These tests pin the stat check in `unlink`
// and `unlinkDir`.

const watchMock = vi.fn()
const handlers = new Map<string, (pathname: string) => void>()

function fakeWatcher(): Record<string, ReturnType<typeof vi.fn>> {
  const w: Record<string, ReturnType<typeof vi.fn>> = {}
  w.on = vi.fn((event: string, handler: (pathname: string) => void) => {
    handlers.set(event, handler)
    return w
  })
  w.close = vi.fn()
  w.add = vi.fn()
  w.unwatch = vi.fn()
  return w
}

vi.mock('chokidar', () => ({
  default: {
    watch: (...args: unknown[]) => {
      watchMock(...args)
      return fakeWatcher()
    }
  }
}))

// Importing the watcher pulls in the markdown loader, whose encoding detection
// uses the native `ced` addon. Its bindings are built for Electron's ABI, not
// the plain-Node test runner, so stub it to keep this spec import-only.
vi.mock('ced', () => ({ default: () => 'UTF-8' }))

import Watcher from 'main_renderer/filesystem/watcher'

// Deletion events resolve asynchronously (a stat decides whether the path is
// really gone), so assertions that expect an emit poll while suppressed
// events only need enough turns for the stat to settle.
const settle = async(): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 50))
}

const fire = (event: string, pathname: string): void => {
  handlers.get(event)?.(pathname)
}

const freshWindow = (): { win: unknown; send: ReturnType<typeof vi.fn> } => {
  const send = vi.fn()
  return { win: { id: 1, isDestroyed: () => false, webContents: { send } }, send }
}

describe('watcher unlink staleness guard', () => {
  let watcher: Watcher

  beforeEach(() => {
    watchMock.mockClear()
    handlers.clear()
    const preferences = { getItem: vi.fn(() => false), getAll: vi.fn(() => ({})), getPreferredEol: vi.fn(() => 'lf') }
    watcher = new Watcher(preferences as never)
  })

  it('suppresses a stale file unlink while the path still exists', async() => {
    const { win, send } = freshWindow()
    const dir = mkdtempSync(join(tmpdir(), 'mt-watch-'))
    const pathname = join(dir, 'note.md')
    writeFileSync(pathname, 'text\n')
    try {
      watcher.watch(win as never, pathname, 'file')
      fire('unlink', pathname)
      await settle()
      expect(send).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports a file unlink when the path is really gone', async() => {
    const { win, send } = freshWindow()
    const dir = mkdtempSync(join(tmpdir(), 'mt-watch-'))
    const pathname = join(dir, 'note.md')
    try {
      watcher.watch(win as never, pathname, 'file')
      fire('unlink', pathname)
      await vi.waitFor(() => expect(send).toHaveBeenCalledWith('mt::update-file', {
        type: 'unlink',
        change: { pathname }
      }))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('suppresses a stale tree unlink while the path still exists', async() => {
    const { win, send } = freshWindow()
    const dir = mkdtempSync(join(tmpdir(), 'mt-watch-'))
    const pathname = join(dir, 'note.md')
    writeFileSync(pathname, 'text\n')
    try {
      watcher.watch(win as never, dir, 'dir')
      fire('unlink', pathname)
      await settle()
      expect(send).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports a tree unlink when the path is really gone', async() => {
    const { win, send } = freshWindow()
    const dir = mkdtempSync(join(tmpdir(), 'mt-watch-'))
    const pathname = join(dir, 'note.md')
    try {
      watcher.watch(win as never, dir, 'dir')
      fire('unlink', pathname)
      await vi.waitFor(() => expect(send).toHaveBeenCalledWith('mt::update-object-tree', {
        type: 'unlink',
        change: { pathname }
      }))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('suppresses a stale directory unlink while the path still exists', async() => {
    const { win, send } = freshWindow()
    const dir = mkdtempSync(join(tmpdir(), 'mt-watch-'))
    const subdir = join(dir, 'sub')
    mkdirSync(subdir)
    try {
      watcher.watch(win as never, dir, 'dir')
      fire('unlinkDir', subdir)
      await settle()
      expect(send).not.toHaveBeenCalled()
      rmSync(subdir, { recursive: true, force: true })
      fire('unlinkDir', subdir)
      await vi.waitFor(() => expect(send).toHaveBeenCalledWith('mt::update-object-tree', {
        type: 'unlinkDir',
        change: { pathname: subdir }
      }))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
