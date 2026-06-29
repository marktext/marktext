import { beforeEach, describe, expect, it, vi } from 'vitest'

// #3955: newly created files appeared in the sidebar ~1s late because the
// directory watcher inherited chokidar's `awaitWriteFinish` (stabilityThreshold
// 1000ms), which defers `add`/`change` events until the file size settles. That
// protection (GH#1043) only matters for the file watcher, which reloads file
// CONTENT on change; the directory watcher just lists nodes and re-sorts by
// mtime. These tests pin that only the file watcher defers events.

const watchMock = vi.fn()

function fakeWatcher(): Record<string, ReturnType<typeof vi.fn>> {
  const w: Record<string, ReturnType<typeof vi.fn>> = {}
  w.on = vi.fn(() => w)
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

import Watcher, {
  WATCHER_STABILITY_THRESHOLD,
  WATCHER_STABILITY_POLL_INTERVAL
} from 'main_renderer/filesystem/watcher'

function optionsForLastWatch(): Record<string, unknown> {
  const calls = watchMock.mock.calls
  return calls[calls.length - 1][1] as Record<string, unknown>
}

describe('watcher awaitWriteFinish (#3955)', () => {
  let watcher: Watcher
  const win = { id: 1, webContents: { send: vi.fn() } }

  beforeEach(() => {
    watchMock.mockClear()
    const preferences = { getItem: vi.fn(() => false) }
    watcher = new Watcher(preferences as never)
  })

  it('does not defer directory-tree events with awaitWriteFinish', () => {
    watcher.watch(win as never, '/project', 'dir')
    expect(optionsForLastWatch().awaitWriteFinish).toBeFalsy()
  })

  it('keeps awaitWriteFinish for the file watcher (GH#1043)', () => {
    watcher.watch(win as never, '/project/note.md', 'file')
    expect(optionsForLastWatch().awaitWriteFinish).toEqual({
      stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
      pollInterval: WATCHER_STABILITY_POLL_INTERVAL
    })
  })
})
