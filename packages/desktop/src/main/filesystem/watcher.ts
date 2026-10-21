import path from 'path'
import fsPromises from 'fs/promises'
import log from 'electron-log'
import chokidar, { type FSWatcher } from 'chokidar'
import { exists } from 'common/filesystem'
import { hasMarkdownExtension, checkPathExcludePattern } from 'common/filesystem/paths'
import { getUniqueId } from '../utils'
import { loadMarkdownFile } from '../filesystem/markdown'
import { isLinux, isOsx } from '../config'
import type { BrowserWindow } from 'electron'
import type { LineEnding } from '@shared/types/files'
import type Preference from '../preferences'
import type { ProjectRootWatch } from '@shared/types/project'
type WatchEmit = (channel: string, payload: unknown) => void

// TODO(refactor): Please see GH#1035.

export const WATCHER_STABILITY_THRESHOLD = 1000
export const WATCHER_STABILITY_POLL_INTERVAL = 150

const EVENT_NAME = {
  dir: 'mt::update-object-tree' as const,
  file: 'mt::update-file' as const
}

type WatchType = 'dir' | 'file'

export const isUncPath = (pathname: string): boolean =>
  /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(pathname)

interface IgnoreEntry {
  windowId: number
  pathname: string
  duration: number
  start: Date
}

interface WatcherEntry {
  win: BrowserWindow
  watcher: FSWatcher
  pathname: string
  type: WatchType
  close: () => void
}

const readSequences = new WeakMap<BrowserWindow, Map<string, number>>()
const nextRead = (win: BrowserWindow, pathname: string, type: WatchType): number => {
  const key = `${type}:${pathname}`
  let sequences = readSequences.get(win)
  if (!sequences) {
    sequences = new Map()
    readSequences.set(win, sequences)
  }
  const sequence = (sequences.get(key) ?? 0) + 1
  sequences.set(key, sequence)
  return sequence
}
const isLatestRead = (
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  sequence: number
): boolean => readSequences.get(win)?.get(`${type}:${pathname}`) === sequence

const add = async(
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  endOfLine: LineEnding,
  autoGuessEncoding: boolean,
  trimTrailingNewline: number,
  autoNormalizeLineEndings: boolean,
  emit: WatchEmit
): Promise<void> => {
  const sequence = nextRead(win, pathname, type)
  const stats = await fsPromises.stat(pathname)
  const birthTime = stats.birthtime
  const mtimeMs = stats.mtimeMs
  const isMarkdown = hasMarkdownExtension(pathname)
  const file: {
    pathname: string
    name: string
    isFile: boolean
    isDirectory: boolean
    birthTime: Date
    mtimeMs: number
    isMarkdown: boolean
    data?: Awaited<ReturnType<typeof loadMarkdownFile>>
  } = {
    pathname,
    name: path.basename(pathname),
    isFile: true,
    isDirectory: false,
    birthTime,
    mtimeMs,
    isMarkdown
  }
  if (isMarkdown) {
    // HACK: But this should be removed completely in #1034/#1035.
    try {
      const data = await loadMarkdownFile(
        pathname,
        endOfLine,
        autoGuessEncoding,
        trimTrailingNewline,
        autoNormalizeLineEndings
      )
      file.data = data
    } catch (err) {
      // Only notify user about opened files.
      if (type === 'file') {
        emit('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
        return
      }
    }
    if (!isLatestRead(win, pathname, type, sequence)) return
    emit(EVENT_NAME[type], {
      type: 'add',
      change: file
    })
  }
}

const unlink = (win: BrowserWindow, pathname: string, type: WatchType, emit: WatchEmit): void => {
  nextRead(win, pathname, type)
  const file = { pathname }
  emit(EVENT_NAME[type], {
    type: 'unlink',
    change: file
  })
}

const change = async(
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  endOfLine: LineEnding,
  autoGuessEncoding: boolean,
  trimTrailingNewline: number,
  autoNormalizeLineEndings: boolean,
  emit: WatchEmit
): Promise<void> => {
  const sequence = nextRead(win, pathname, type)
  if (type === 'dir') {
    // Only send mtimeMs so the sidebar can re-sort; skip loading file content.
    try {
      const stats = await fsPromises.stat(pathname)
      emit('mt::update-object-tree', {
        type: 'change',
        change: { pathname, mtimeMs: stats.mtimeMs }
      })
    } catch {
      // File may have been deleted between the event and the stat; ignore.
    }
    return
  }

  const isMarkdown = hasMarkdownExtension(pathname)
  if (isMarkdown) {
    try {
      const [data, stats] = await Promise.all([
        loadMarkdownFile(
          pathname,
          endOfLine,
          autoGuessEncoding,
          trimTrailingNewline,
          autoNormalizeLineEndings
        ),
        fsPromises.stat(pathname)
      ])
      const file = { pathname, data, mtimeMs: stats.mtimeMs }
      if (!isLatestRead(win, pathname, type, sequence)) return
      emit('mt::update-file', {
        type: 'change',
        change: file
      })
    } catch (err) {
      if (type === 'file') {
        emit('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }
}

const addDir = (win: BrowserWindow, pathname: string, type: WatchType, emit: WatchEmit): void => {
  if (type === 'file') return

  const directory = {
    pathname,
    name: path.basename(pathname),
    isCollapsed: true,
    isDirectory: true,
    isFile: false,
    isMarkdown: false,
    folders: [],
    files: []
  }

  emit('mt::update-object-tree', {
    type: 'addDir',
    change: directory
  })
}

const unlinkDir = (win: BrowserWindow, pathname: string, type: WatchType, emit: WatchEmit): void => {
  if (type === 'file') return

  const directory = { pathname }
  emit('mt::update-object-tree', {
    type: 'unlinkDir',
    change: directory
  })
}

class Watcher {
  private _preferences: Preference
  private _ignoreChangeEvents: IgnoreEntry[]
  watchers: Record<string, WatcherEntry>

  constructor(preferences: Preference) {
    this._preferences = preferences
    this._ignoreChangeEvents = []
    this.watchers = {}
  }

  watch(win: BrowserWindow, watchPath: string, type: WatchType = 'dir', context?: ProjectRootWatch): () => void {
    const usePolling =
      isOsx || isUncPath(watchPath) ? true : this._preferences.getItem<boolean>('watcherUsePolling')

    const id = getUniqueId()

    const watcher = chokidar.watch(watchPath, {
      ignored: (pathname: string, fileInfo?: { isDirectory: () => boolean }) => {
        if (!fileInfo) {
          return /(?:^|[/\\])(?:node_modules|(?:.+\.asar))/.test(pathname)
        }

        if (/(?:^|[/\\])(?:node_modules|(?:.+\.asar))/.test(pathname)) {
          return true
        }

        if (
          checkPathExcludePattern(
            pathname,
            this._preferences.getItem<readonly string[]>('treePathExcludePatterns')
          )
        ) {
          return true
        }
        if (fileInfo.isDirectory()) {
          return false
        }
        return !hasMarkdownExtension(pathname)
      },
      ignoreInitial: type === 'file',
      persistent: true,
      ignorePermissionErrors: !context,

      depth: type === 'file' ? (isOsx ? 1 : 0) : undefined,

      // Defer events until writes settle only for the file watcher, which
      // reloads file CONTENT on change and would otherwise read a partial file
      // (GH#1043). The directory watcher just lists nodes and re-sorts by mtime,
      // so deferring its `add` events only made new files appear in the sidebar
      // ~1s late (GH#3955).
      ...(type === 'file'
        ? {
          awaitWriteFinish: {
            stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
            pollInterval: WATCHER_STABILITY_POLL_INTERVAL
          }
        }
        : {}),

      usePolling
      // chokidar's `ignored` callback signature varies between versions; this options
      // bag works at runtime but defies the bundled type.
    } as unknown as Parameters<typeof chokidar.watch>[1])

    let disposed = false
    let failed = false
    const initialReads: Promise<void>[] = []
    let initialScan = true
    const emit: WatchEmit = (channel, payload) => {
      if (disposed || win.isDestroyed?.()) return
      win.webContents.send(channel, channel === 'mt::update-object-tree' && context
        ? { ...(payload as object), rootKey: context.rootKey, watchToken: context.watchToken }
        : payload)
    }
    const read = (task: Promise<void>): void => {
      const guarded = task.catch(error => {
        if (!disposed) log.warn('Directory event could not be read:', error)
      })
      if (initialScan) initialReads.push(guarded)
    }
    let enospcReached = false
    let renameTimer: NodeJS.Timeout | null = null

    const handleFileEvent = async(pathname: string, event: 'add' | 'change'): Promise<void> => {
      if (disposed || await this._shouldIgnoreEvent(win.id, pathname, type, usePolling)) return
      const { autoGuessEncoding = true, trimTrailingNewline = 2, autoNormalizeLineEndings = false } = this._preferences.getAll()
      await (event === 'add' ? add : change)(win, pathname, type,
        this._preferences.getPreferredEol() as LineEnding,
        autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings, emit)
    }
    watcher
      .on('add', (pathname: string) => read(handleFileEvent(pathname, 'add')))
      .on('change', (pathname: string) => read(handleFileEvent(pathname, 'change')))
      .on('unlink', (pathname: string) => unlink(win, pathname, type, emit))
      .on('addDir', (pathname: string) => addDir(win, pathname, type, emit))
      .on('unlinkDir', (pathname: string) => {
        unlinkDir(win, pathname, type, emit)
        if (!disposed && pathname === watchPath) {
          failed = true
          context?.onStatus('unavailable')
        }
      })
      .on('ready', () => {
        initialScan = false
        Promise.all(initialReads).then(() => {
          if (!disposed && !failed) context?.onStatus('ready')
        })
      })
      .on('raw', (event: string, subpath: string, details: unknown) => {
        if (globalThis.MARKTEXT_DEBUG_VERBOSE >= 3) {
          console.log('watcher: ', event, subpath, details)
        }

        // Fix atomic rename on Linux (chokidar#591).
        if (isLinux && type === 'file' && event === 'rename') {
          if (renameTimer) {
            clearTimeout(renameTimer)
          }
          renameTimer = setTimeout(async() => {
            renameTimer = null
            if (disposed) {
              return
            }

            const fileExists = await exists(watchPath)
            if (fileExists) {
              watcher.unwatch(watchPath)
              watcher.add(watchPath)
            }
          }, 150)
        }
      })
      .on('error', (error: unknown) => {
        if (disposed) return
        failed = true
        context?.onStatus('unavailable', error instanceof Error ? error.message : String(error))
        const code = (error as NodeJS.ErrnoException)?.code
        if (code === 'ENOSPC') {
          if (!enospcReached) {
            enospcReached = true
            log.warn('inotify limit reached: Too many file descriptors are opened.')

            win.webContents.send('mt::show-notification', {
              title: 'inotify limit reached',
              type: 'warning',
              message:
                'Cannot watch all files and file changes because too many file descriptors are opened.'
            })
          }
        } else {
          log.error('Error while watching files:', error)
        }
      })

    const closeFn = (): void => {
      disposed = true
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
      if (renameTimer) {
        clearTimeout(renameTimer)
        renameTimer = null
      }
      watcher.close()
    }

    this.watchers[id] = {
      win,
      watcher,
      pathname: watchPath,
      type,
      close: closeFn
    }

    return closeFn
  }

  unwatch(win: BrowserWindow, watchPath: string, type: WatchType = 'dir'): void {
    for (const id of Object.keys(this.watchers)) {
      const w = this.watchers[id]
      if (w.win === win && w.pathname === watchPath && w.type === type) {
        w.close()
        break
      }
    }
  }

  unwatchByWindowId(windowId: number): void {
    for (const entry of Object.values(this.watchers)) {
      if (entry.win.id === windowId) entry.close()
    }
  }

  close(): void {
    Object.keys(this.watchers).forEach((id) => this.watchers[id].close())
    this.watchers = {}
    this._ignoreChangeEvents = []
  }

  /**
   * Ignore the next changed event within a certain time for the current file
   * and window. Only valid for files and "add"/"change" events.
   */
  ignoreChangedEvent(
    windowId: number,
    pathname: string,
    duration: number = WATCHER_STABILITY_THRESHOLD + WATCHER_STABILITY_POLL_INTERVAL * 2
  ): void {
    this._ignoreChangeEvents.push({ windowId, pathname, duration, start: new Date() })
  }

  /**
   * Check whether we should ignore the current event because the file may be
   * changed from MarkText itself.
   */
  async _shouldIgnoreEvent(
    winId: number,
    pathname: string,
    type: WatchType,
    usePolling: boolean
  ): Promise<boolean> {
    if (type === 'file') {
      const { _ignoreChangeEvents } = this
      const currentTime = new Date()
      for (let i = 0; i < _ignoreChangeEvents.length; ++i) {
        const { windowId, pathname: pathToIgnore, start, duration } = _ignoreChangeEvents[i]
        if (windowId === winId && pathToIgnore === pathname) {
          _ignoreChangeEvents.splice(i, 1)
          --i

          // Modification origin is the editor and we should ignore the event.
          if (currentTime.getTime() - start.getTime() < duration) {
            return true
          }

          // Try to catch cloud drives that emit the change event not
          // immediately or re-sync the change (GH#3044).
          if (!usePolling) {
            try {
              const fileInfo = await fsPromises.stat(pathname)
              if (fileInfo.mtime.getTime() - start.getTime() < duration) {
                if (globalThis.MARKTEXT_DEBUG_VERBOSE >= 3) {
                  console.log(
                    `Ignoring file event after "stat": current="${currentTime.toISOString()}", start="${start.toISOString()}", file="${fileInfo.mtime.toISOString()}".`
                  )
                }
                return true
              }
            } catch (error) {
              console.error('Failed to "stat" file to determine modification time:', error)
            }
          }
        }
      }
    }
    return false
  }
}

export default Watcher
