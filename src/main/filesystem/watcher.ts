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

// TODO(refactor): Please see GH#1035.

export const WATCHER_STABILITY_THRESHOLD = 1000
export const WATCHER_STABILITY_POLL_INTERVAL = 150

const EVENT_NAME = {
  dir: 'mt::update-object-tree' as const,
  file: 'mt::update-file' as const
}

type WatchType = 'dir' | 'file'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Preferences = any

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

const add = async(
  win: BrowserWindow,
  pathname: string,
  type: WatchType,
  endOfLine: LineEnding,
  autoGuessEncoding: boolean,
  trimTrailingNewline: number,
  autoNormalizeLineEndings: boolean
): Promise<void> => {
  const stats = await fsPromises.stat(pathname)
  const birthTime = stats.birthtime
  const mtimeMs = stats.mtimeMs
  const isMarkdown = hasMarkdownExtension(pathname)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const file: any = {
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
        win.webContents.send('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
        return
      }
    }
    win.webContents.send(EVENT_NAME[type], {
      type: 'add',
      change: file
    })
  }
}

const unlink = (win: BrowserWindow, pathname: string, type: WatchType): void => {
  const file = { pathname }
  win.webContents.send(EVENT_NAME[type], {
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
  autoNormalizeLineEndings: boolean
): Promise<void> => {
  if (type === 'dir') {
    // Only send mtimeMs so the sidebar can re-sort; skip loading file content.
    try {
      const stats = await fsPromises.stat(pathname)
      win.webContents.send('mt::update-object-tree', {
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
        loadMarkdownFile(pathname, endOfLine, autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings),
        fsPromises.stat(pathname)
      ])
      const file = { pathname, data, mtimeMs: stats.mtimeMs }
      win.webContents.send('mt::update-file', {
        type: 'change',
        change: file
      })
    } catch (err) {
      if (type === 'file') {
        win.webContents.send('mt::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }
}

const addDir = (win: BrowserWindow, pathname: string, type: WatchType): void => {
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

  win.webContents.send('mt::update-object-tree', {
    type: 'addDir',
    change: directory
  })
}

const unlinkDir = (win: BrowserWindow, pathname: string, type: WatchType): void => {
  if (type === 'file') return

  const directory = { pathname }
  win.webContents.send('mt::update-object-tree', {
    type: 'unlinkDir',
    change: directory
  })
}

class Watcher {
  private _preferences: Preferences
  private _ignoreChangeEvents: IgnoreEntry[]
  watchers: Record<string, WatcherEntry>

  constructor(preferences: Preferences) {
    this._preferences = preferences
    this._ignoreChangeEvents = []
    this.watchers = {}
  }

  watch(win: BrowserWindow, watchPath: string, type: WatchType = 'dir'): () => void {
    const usePolling = isOsx ? true : this._preferences.getItem('watcherUsePolling')

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
          checkPathExcludePattern(pathname, this._preferences.getItem('treePathExcludePatterns'))
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
      ignorePermissionErrors: true,

      depth: type === 'file' ? (isOsx ? 1 : 0) : undefined,

      // Please see GH#1043
      awaitWriteFinish: {
        stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
        pollInterval: WATCHER_STABILITY_POLL_INTERVAL
      },

      usePolling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chokidar's `ignored` callback signature varies between versions; this options bag works at runtime but defies the bundled type
    } as any)

    let disposed = false
    let enospcReached = false
    let renameTimer: NodeJS.Timeout | null = null

    watcher
      .on('add', async(pathname: string) => {
        if (!(await this._shouldIgnoreEvent(win.id, pathname, type, usePolling))) {
          const { _preferences } = this
          const eol = _preferences.getPreferredEol() as LineEnding
          const { autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings } =
            _preferences.getAll()
          add(
            win,
            pathname,
            type,
            eol,
            autoGuessEncoding,
            trimTrailingNewline,
            autoNormalizeLineEndings
          )
        }
      })
      .on('change', async(pathname: string) => {
        if (!(await this._shouldIgnoreEvent(win.id, pathname, type, usePolling))) {
          const { _preferences } = this
          const eol = _preferences.getPreferredEol() as LineEnding
          const { autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings } =
            _preferences.getAll()
          change(
            win,
            pathname,
            type,
            eol,
            autoGuessEncoding,
            trimTrailingNewline,
            autoNormalizeLineEndings
          )
        }
      })
      .on('unlink', (pathname: string) => unlink(win, pathname, type))
      .on('addDir', (pathname: string) => addDir(win, pathname, type))
      .on('unlinkDir', (pathname: string) => unlinkDir(win, pathname, type))
      .on('raw', (event: string, subpath: string, details: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((globalThis as any).MARKTEXT_DEBUG_VERBOSE >= 3) {
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
        w.watcher.close()
        delete this.watchers[id]
        break
      }
    }
  }

  unwatchByWindowId(windowId: number): void {
    const watchers: FSWatcher[] = []
    const watchIds: string[] = []
    for (const id of Object.keys(this.watchers)) {
      const w = this.watchers[id]
      if (w.win.id === windowId) {
        watchers.push(w.watcher)
        watchIds.push(id)
      }
    }
    if (watchers.length) {
      watchIds.forEach((id) => delete this.watchers[id])
      watchers.forEach((watcher) => watcher.close())
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((globalThis as any).MARKTEXT_DEBUG_VERBOSE >= 3) {
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
