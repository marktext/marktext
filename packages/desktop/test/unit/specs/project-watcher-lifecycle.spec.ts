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
})
