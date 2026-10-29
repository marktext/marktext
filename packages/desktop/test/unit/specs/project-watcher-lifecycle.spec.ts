import fs from 'fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  instances: [] as Array<{ emit: (name: string, ...args: unknown[]) => void }>
}))
vi.mock('chokidar', () => ({
  default: {
    watch: () => {
      const listeners = new Map<string, (...args: unknown[]) => void>()
      const watcher = {
        on: (name: string, handler: (...args: unknown[]) => void) => {
          listeners.set(name, handler)
          return watcher
        },
        close: vi.fn(),
        emit: (name: string, ...args: unknown[]) => listeners.get(name)?.(...args)
      }
      mocks.instances.push(watcher)
      return watcher
    }
  }
}))
vi.mock('main_renderer/filesystem/markdown', () => ({
  loadMarkdownFile: vi.fn(async() => ({ markdown: '# Note' }))
}))
import Watcher from 'main_renderer/filesystem/watcher'

describe('project watcher lifecycle (#2222)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.instances.length = 0
  })

  it('drops an async read that finishes after the root has been removed', async() => {
    let finish!: (value: never) => void
    const stat = vi.spyOn(fs, 'stat').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }) as never
    )
    const send = vi.fn()
    const win = { id: 1, isDestroyed: () => false, webContents: { send } }
    const watcher = new Watcher({
      getItem: () => [],
      getAll: () => ({}),
      getPreferredEol: () => 'lf'
    } as never)
    const onStatus = vi.fn()
    watcher.watch(win as never, '/project', 'dir', { rootKey: 'root', watchToken: 'old', onStatus })
    mocks.instances[0].emit('add', '/project/note.md')
    await vi.waitFor(() => expect(stat).toHaveBeenCalled())
    watcher.unwatch(win as never, '/project', 'dir')
    finish({ birthtime: new Date(), mtimeMs: 1 } as never)
    mocks.instances[0].emit('ready')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(send).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()
  })

  it('attaches root identity to tree events and reports a missing root', () => {
    const send = vi.fn()
    const onStatus = vi.fn()
    const watcher = new Watcher({ getItem: () => [] } as never)
    watcher.watch({ id: 1, webContents: { send } } as never, '/project', 'dir', {
      rootKey: 'root',
      watchToken: 'current',
      onStatus
    })
    mocks.instances[0].emit('addDir', '/project/child')
    expect(send).toHaveBeenCalledWith(
      'mt::update-object-tree',
      expect.objectContaining({ rootKey: 'root', watchToken: 'current', type: 'addDir' })
    )
    mocks.instances[0].emit('unlinkDir', '/project')
    expect(onStatus).toHaveBeenCalledWith('unavailable')
  })

  it('ignores only affected open-file deletions while a move is in progress', async() => {
    const send = vi.fn()
    const observeFile = vi.fn()
    const win = { id: 1, webContents: { send } }
    const watcher = new Watcher({ getItem: () => [] } as never, observeFile)
    watcher.watch(win as never, '/project/chapter/a.md', 'file')
    watcher.watch(win as never, '/project/chapter/b.md', 'file')
    watcher.watch(win as never, '/project/unrelated.md', 'file')
    watcher.watch(win as never, '/project', 'dir')
    let finish = () => {}
    const moving = watcher.withIgnoredFileDeletions(win as never, [
      '/project/chapter/a.md', '/project/chapter/b.md'
    ], () => new Promise<void>(resolve => { finish = resolve }))

    mocks.instances[0].emit('unlink', '/project/chapter/a.md')
    mocks.instances[1].emit('unlink', '/project/chapter/b.md')
    expect(send).not.toHaveBeenCalled()
    expect(observeFile).not.toHaveBeenCalled()

    mocks.instances[2].emit('unlink', '/project/unrelated.md')
    expect(observeFile).toHaveBeenCalledExactlyOnceWith(win, {
      type: 'unlink', change: { pathname: '/project/unrelated.md' }
    })
    mocks.instances[3].emit('unlink', '/project/chapter/a.md')
    expect(send).toHaveBeenCalledWith('mt::update-object-tree', {
      type: 'unlink', change: { pathname: '/project/chapter/a.md' }
    })

    finish()
    await moving
    mocks.instances[0].emit('unlink', '/project/chapter/a.md')
    expect(observeFile).toHaveBeenLastCalledWith(win, {
      type: 'unlink', change: { pathname: '/project/chapter/a.md' }
    })
  })

  it('keeps other windows observable and releases the deletion barrier after failure', async() => {
    const observeFile = vi.fn()
    const send = vi.fn()
    const win = { id: 1, webContents: { send } }
    const other = { id: 2, webContents: { send } }
    const watcher = new Watcher({ getItem: () => [] } as never, observeFile)
    watcher.watch(win as never, '/project/a.md', 'file')
    watcher.watch(other as never, '/project/a.md', 'file')
    await expect(watcher.withIgnoredFileDeletions(win as never, ['/project/a.md'], async() => {
      mocks.instances[0].emit('unlink', '/project/a.md')
      mocks.instances[1].emit('unlink', '/project/a.md')
      expect(observeFile).toHaveBeenCalledExactlyOnceWith(other, {
        type: 'unlink', change: { pathname: '/project/a.md' }
      })
      throw new Error('Move failed')
    })).rejects.toThrow('Move failed')
    mocks.instances[0].emit('unlink', '/project/a.md')
    expect(observeFile).toHaveBeenLastCalledWith(win, {
      type: 'unlink', change: { pathname: '/project/a.md' }
    })
  })

  it('reconciles a suppressed deletion through the normal observer and renderer path on failure', async() => {
    vi.spyOn(fs, 'stat').mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }))
    const send = vi.fn()
    const observeFile = vi.fn()
    const win = { id: 1, webContents: { send } }
    const watcher = new Watcher({ getItem: () => [] } as never, observeFile)
    watcher.watch(win as never, '/project/a.md', 'file')
    await expect(watcher.withIgnoredFileDeletions(win as never, ['/project/a.md'], async() => {
      mocks.instances[0].emit('unlink', '/project/a.md')
      expect(send).not.toHaveBeenCalled()
      throw new Error('Move failed')
    })).rejects.toThrow('Move failed')
    const deletion = { type: 'unlink', change: { pathname: '/project/a.md' } }
    expect(observeFile).toHaveBeenCalledExactlyOnceWith(win, deletion)
    expect(send).toHaveBeenCalledExactlyOnceWith('mt::update-file', deletion)
  })

  it('does not replay a suppressed deletion if the source exists again after failure', async() => {
    vi.spyOn(fs, 'stat').mockResolvedValue({} as never)
    const send = vi.fn()
    const observeFile = vi.fn()
    const win = { id: 1, webContents: { send } }
    const watcher = new Watcher({ getItem: () => [] } as never, observeFile)
    watcher.watch(win as never, '/project/a.md', 'file')
    await expect(watcher.withIgnoredFileDeletions(win as never, ['/project/a.md'], async() => {
      mocks.instances[0].emit('unlink', '/project/a.md')
      throw new Error('Move failed')
    })).rejects.toThrow('Move failed')
    expect(send).not.toHaveBeenCalled()
    expect(observeFile).not.toHaveBeenCalled()
  })
})
