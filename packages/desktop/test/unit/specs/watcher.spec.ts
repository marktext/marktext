import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { EventEmitter } from 'events'

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

interface MockWatcher {
  on: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  unwatch: ReturnType<typeof vi.fn>
  add: ReturnType<typeof vi.fn>
  emitter: EventEmitter
}

function createMockWatcher(): MockWatcher {
  const emitter = new EventEmitter()
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler)
      return emitter
    }),
    close: vi.fn(),
    unwatch: vi.fn(),
    add: vi.fn(),
    emitter
  }
}

const watchers: MockWatcher[] = []
const chokidarWatchMock = vi.fn(() => {
  const w = createMockWatcher()
  watchers.push(w)
  return w
})

vi.mock('chokidar', () => ({
  default: {
    watch: (...args: Parameters<typeof chokidarWatchMock>) => chokidarWatchMock(...args)
  }
}))

vi.mock('electron-log', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn()
  }
}))

const defaultStat = {
  birthtime: new Date('2024-01-01'),
  mtimeMs: 1704067200000,
  mtime: new Date('2024-01-01'),
  isFile: () => true,
  isDirectory: () => false,
  isSymbolicLink: () => false
}

const mockReaddir = vi.fn()
const mockStat = vi.fn().mockResolvedValue(defaultStat)

vi.mock('fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args)
  }
}))

vi.mock('common/filesystem', () => ({
  exists: vi.fn()
}))

// Prevent `ced` native bindings from being loaded during the dynamic import
// of watcher.ts (which transitively imports loadMarkdownFile → ... → ced).
// In CI, ced is compiled for Electron's Node.js ABI and fails to load under
// the system Node.js that vitest uses.
vi.mock('ced', () => ({ default: {} }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockPreference {
  getItem: Mock
  getPreferredEol: Mock
  getAll: Mock
  setItems?: Mock
}

function createMockPreferences(
  overrides?: Partial<{ watcherUsePolling: boolean }>
): MockPreference {
  const polling = overrides?.watcherUsePolling ?? false
  return {
    getItem: vi.fn((key: string) => {
      if (key === 'watcherUsePolling') return polling
      if (key === 'treePathExcludePatterns') return []
      return undefined
    }),
    getPreferredEol: vi.fn(() => 'lf'),
    getAll: vi.fn(() => ({
      autoGuessEncoding: true,
      trimTrailingNewline: 2,
      autoNormalizeLineEndings: false
    }))
  }
}

function createMockBrowserWindow(): Record<string, unknown> {
  return {
    id: 1,
    webContents: {
      send: vi.fn()
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  watchers.length = 0
  chokidarWatchMock.mockClear()
  mockReaddir.mockReset()
  mockStat.mockReset()
  mockStat.mockResolvedValue(defaultStat)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Watcher fallback detection', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadWatcher(): Promise<{ default: new (pref: any) => { watch: (...args: any[]) => () => void; unwatch: (...args: any[]) => void } }> {
    return await import('../../../src/main/filesystem/watcher')
  }

  it('does not trigger fallback when events are received before ready', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    watcher.watch(win as never, '/some/dir', 'dir')
    const mockW = watchers[0]

    // Simulate chokidar finding content
    mockW.emitter.emit('addDir', '/some/dir/sub')
    mockW.emitter.emit('add', '/some/dir/file.md')
    expect(mockW.on).toHaveBeenCalledWith('ready', expect.any(Function))

    // Emit ready — fallback should NOT trigger since we had events
    mockW.emitter.emit('ready')

    await Promise.resolve()

    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
    expect(mockW.close).not.toHaveBeenCalled()
  })

  it('triggers fallback when no events on non-empty directory', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([
      { name: 'doc.md', isDirectory: () => false },
      { name: 'notes.md', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/sshfs/dir', 'dir')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')

    await vi.runAllTimersAsync()
    await Promise.resolve()

    // _addFallbackDetection calls readdir, then _startUncPolling also calls readdir via _scanUncDirectory
    expect(mockReaddir).toHaveBeenCalledWith('/sshfs/dir', { withFileTypes: true })
    expect(mockW.close).toHaveBeenCalled()
    // The fallback uses _startUncPolling (no chokidar), so only one chokidar instance
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger fallback when directory is empty', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([])

    watcher.watch(win as never, '/empty/dir', 'dir')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(mockReaddir).toHaveBeenCalledWith('/empty/dir', { withFileTypes: true })
    expect(mockW.close).not.toHaveBeenCalled()
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger fallback when directory has only non-markdown files', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    // .jpg is not a markdown extension in MarkText
    mockReaddir.mockResolvedValue([
      { name: 'photo.jpg', isDirectory: () => false },
      { name: 'archive.zip', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/nonmd/dir', 'dir')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(mockReaddir).toHaveBeenCalled()
    expect(mockW.close).not.toHaveBeenCalled()
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
  })

  it('does not trigger fallback for file watches', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([
      { name: 'doc.md', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/file.md', 'file')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
    expect(mockW.close).not.toHaveBeenCalled()
  })

  it('does not trigger fallback when usePolling preference is true', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences({ watcherUsePolling: true })
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([
      { name: 'doc.md', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/polling/dir', 'dir')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    // With usePolling: true, fallback detection is not added
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
    expect(mockW.close).not.toHaveBeenCalled()
  })

  it('fallback is idempotent (double ready does not double-fallback)', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([
      { name: 'doc.md', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/idempotent/dir', 'dir')
    const mockW = watchers[0]

    mockW.emitter.emit('ready')
    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    // Should have triggered fallback only once (native = 1, fallback uses _startUncPolling)
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
    expect(mockW.close).toHaveBeenCalledTimes(1)
  })

  it('does not trigger fallback when watcher was already closed externally', async() => {
    const { default: WatcherClass } = await loadWatcher()
    const prefs = createMockPreferences()
    const win = createMockBrowserWindow()
    const watcher = new WatcherClass(prefs as never)

    mockReaddir.mockResolvedValue([
      { name: 'doc.md', isDirectory: () => false }
    ])

    watcher.watch(win as never, '/transient/dir', 'dir')
    const mockW = watchers[0]

    // Close via unwatch (simulating user closing the folder)
    watcher.unwatch(win as never, '/transient/dir', 'dir')

    mockW.emitter.emit('ready')
    await vi.runAllTimersAsync()
    await Promise.resolve()

    // Fallback should NOT trigger because the entry was removed
    expect(mockReaddir).not.toHaveBeenCalled()
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
  })
})
