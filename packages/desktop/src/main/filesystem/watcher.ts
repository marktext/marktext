import path from 'path'
import fs, { type Dirent } from 'fs'
import fsPromises from 'fs/promises'
import log from 'electron-log'
import chokidar, { type FSWatcher } from 'chokidar'
import { exists } from 'common/filesystem'
import { hasMarkdownExtension, checkPathExcludePattern } from 'common/filesystem/paths'
import { getUniqueId } from '../utils'
import { loadMarkdownFile } from '../filesystem/markdown'
import { isLinux, isOsx, isWindows } from '../config'
import type { BrowserWindow } from 'electron'
import type { LineEnding } from '@shared/types/files'
import type Preference from '../preferences'

// TODO(refactor): Please see GH#1035.

export const WATCHER_STABILITY_THRESHOLD = 1000
export const WATCHER_STABILITY_POLL_INTERVAL = 150

/**
 * How often (in ms) to poll the directory tree when using the UNC fallback.
 *
 * chokidar / fs.watch cannot watch Windows UNC paths (\\server\share, \\wsl.localhost\…)
 * because virtual filesystems such as WSL2's 9P protocol do not support
 * ReadDirectoryChangesW or inotify.  The same limitation applies to SSHFS mounts,
 * network drives, and Docker-mounted volumes that use FUSE or VirtioFS.
 *
 * Other projects that have hit this:
 *   - VS Code  ships its own FileWatcher with a polling fallback for UNC paths.
 *   - Cypress  forces CHOKIDAR_USEPOLLING=1 for WSL.
 *   - Angular  recommends polling or moving sources out of the 9P mount.
 *   - Vite     exposes server.watch.usePolling for the same reason.
 */
const UNC_POLL_INTERVAL = 3000

const EVENT_NAME = {
  dir: 'mt::update-object-tree' as const,
  file: 'mt::update-file' as const
}

type WatchType = 'dir' | 'file'

interface IgnoreEntry {
  windowId: number
  pathname: string
  duration: number
  start: Date
}

interface WatcherEntry {
  win: BrowserWindow
  watcher: FSWatcher | { close: () => void }
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
  private _preferences: Preference
  private _ignoreChangeEvents: IgnoreEntry[]
  watchers: Record<string, WatcherEntry>

  constructor(preferences: Preference) {
    this._preferences = preferences
    this._ignoreChangeEvents = []
    this.watchers = {}
  }

  watch(win: BrowserWindow, watchPath: string, type: WatchType = 'dir'): () => void {
    // Windows UNC paths (\\server\share, \\wsl.localhost\…) cannot be watched by
    // chokidar/fs.watch because virtual filesystems (WSL2 9P, SSHFS, network drives)
    // do not support ReadDirectoryChangesW or inotify.  We fall back to a manual
    // readdir-based poll loop — see UNC_POLL_INTERVAL for details.
    const needsPolling = isWindows && (() => {
      try {
        fs.realpathSync.native(watchPath)
        return false
      } catch {
        return true
      }
    })()
    if (needsPolling) {
      if (type === 'file') {
        return this._watchUncFile(win, watchPath)
      }
      return this._startUncPolling(win, watchPath, type)
    }

    const usePolling = isOsx ? true : this._preferences.getItem<boolean>('watcherUsePolling')
    return this._startWatcher(win, watchPath, type, usePolling)
  }

  private _startWatcher(
    win: BrowserWindow,
    watchPath: string,
    type: WatchType,
    usePolling: boolean
  ): () => void {
    const id = getUniqueId()
    const { _preferences } = this

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
            _preferences.getItem<readonly string[]>('treePathExcludePatterns')
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
      ignorePermissionErrors: true,

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
    let enospcReached = false
    let renameTimer: NodeJS.Timeout | null = null

    watcher
      .on('add', async(pathname: string) => {
        if (!(await this._shouldIgnoreEvent(win.id, pathname, type, usePolling))) {
          const { _preferences } = this
          const eol = _preferences.getPreferredEol() as LineEnding
          const {
            autoGuessEncoding = true,
            trimTrailingNewline = 2,
            autoNormalizeLineEndings = false
          } = _preferences.getAll()
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
          const {
            autoGuessEncoding = true,
            trimTrailingNewline = 2,
            autoNormalizeLineEndings = false
          } = _preferences.getAll()
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
        if (
          globalThis.MARKTEXT_DEBUG_VERBOSE >= 3
        ) {
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
      // Guard: exit early if the entry was already replaced by a fallback restart
      if (!this.watchers[id]) return
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

    // Fallback: when native file watching silently fails (e.g., SSHFS on Windows,
    // SMB/CIFS network shares, or remote filesystems that don't support
    // ReadDirectoryChangesW), switch to polling. Chokidar's initial scan won't
    // emit any events if the underlying platform doesn't support native watching.
    if (type === 'dir' && !usePolling) {
      this._addFallbackDetection(win, watchPath, type, id, watcher)
    }

    return closeFn
  }

  /**
   * Detect when chokidar's native watching fails to emit initial events for a
   * non-empty directory, and restart the watcher with polling enabled.
   *
   * This handles SSHFS/WinFsp, SMB/CIFS network shares, and other filesystems
   * that don't support the native filesystem notification API on Windows.
   */
  private _addFallbackDetection(
    win: BrowserWindow,
    watchPath: string,
    type: WatchType,
    id: string,
    watcher: FSWatcher
  ): void {
    let initialEventCount = 0
    let fallbackTriggered = false

    const onAnyEvent = (): void => { initialEventCount++ }

    watcher.on('add', onAnyEvent)
    watcher.on('addDir', onAnyEvent)

    const attemptFallback = async(force = false): Promise<void> => {
      if (fallbackTriggered) return
      if (!force && initialEventCount > 0) return

      const entry = this.watchers[id]
      if (!entry || entry.watcher !== watcher) return

      fallbackTriggered = true

      try {
        const entries = await fsPromises.readdir(watchPath, { withFileTypes: true })
        const hasWatchableContent = entries.some(e =>
          e.isDirectory() || hasMarkdownExtension(e.name)
        )
        if (!hasWatchableContent) return

        log.warn(
          `[Watcher] No initial events for non-empty directory "${watchPath}". ` +
          'Native file watching may not be supported on this filesystem. ' +
          'Restarting watcher with polling.'
        )

        watcher.close()
        delete this.watchers[id]

        this._startUncPolling(win, watchPath, type)
      } catch (err) {
        log.error(`[Watcher] Failed to read directory "${watchPath}":`, err)
      }
    }

    // Listen on 'ready' — without awaitWriteFinish blocking the scan this
    // fires sub-second even on slow filesystems, so no safety timeout needed.
    watcher.on('ready', () => attemptFallback(false))

    // On Windows, chokidar's native watcher may emit UNKNOWN errors on FUSE
    // mounts (SSHFS/WinFsp, WSL 9P) — fall back to polling regardless of
    // whether an initial addDir event was already emitted.
    watcher.on('error', (error: unknown) => {
      if (isWindows && (error as NodeJS.ErrnoException)?.code === 'UNKNOWN') {
        attemptFallback(true)
      }
    })
  }

  /**
   * Polling-based file-tree scanner for Windows UNC paths / FUSE mounts.
   *
   * chokidar relies on fs.watch / ReadDirectoryChangesW under the hood, which
   * does not work on virtual filesystems such as WSL2's 9P server, SSHFS mounts,
   * or mapped network drives (see Node.js#37960, chokidar#1206, chokidar#1376).
   *
   * This method bypasses chokidar entirely: it runs a recursive readdir scan on
   * every tick and emits add / addDir / unlink / unlinkDir events to the renderer
   * in the same format that chokidar would use.  The renderer's tree controller
   * treats them identically, so the rest of the UI is unaffected.
   *
   * The same strategy (manual polling for UNC / virtual FS roots) is used by
   * VS Code, Cypress, Angular CLI, and Vite — none of which can rely on the
   * OS-native watcher across those mount boundaries.
   */
  private _watchUncFile(win: BrowserWindow, watchPath: string): () => void {
    log.info('[Watcher] Starting UNC file polling for:', watchPath)

    const id = getUniqueId()
    let disposed = false

    const handler = async(): Promise<void> => {
      if (disposed) return

      const isMarkdown = hasMarkdownExtension(watchPath)
      if (isMarkdown) {
        const { _preferences } = this
        const eol = _preferences.getPreferredEol() as LineEnding
        const {
          autoGuessEncoding = true,
          trimTrailingNewline = 2,
          autoNormalizeLineEndings = false
        } = _preferences.getAll()

        // Simulate the same work chokidar would do on a "change" event.
        try {
          const [data, stats] = await Promise.all([
            loadMarkdownFile(watchPath, eol, autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings),
            fsPromises.stat(watchPath)
          ])
          win.webContents.send('mt::update-file', {
            type: 'change',
            change: { pathname: watchPath, data, mtimeMs: stats.mtimeMs }
          })
        } catch {
          // File may have been removed — send unlink.
          win.webContents.send('mt::update-file', {
            type: 'unlink',
            change: { pathname: watchPath }
          })
        }
      }
    }

    // Periodically stat the file — same as chokidar's polling path would do.
    fs.watchFile(watchPath, { interval: UNC_POLL_INTERVAL }, () => {
      handler().catch(err => log.error('[Watcher] UNC file poll error:', err))
    })

    const closeFn = (): void => {
      disposed = true
      fs.unwatchFile(watchPath)
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
    }

    this.watchers[id] = {
      win,
      watcher: { close: closeFn },
      pathname: watchPath,
      type: 'file',
      close: closeFn
    }

    return closeFn
  }

  private _startUncPolling(
    win: BrowserWindow,
    watchPath: string,
    type: WatchType
  ): () => void {
    log.info('[Watcher] Starting UNC polling fallback for:', watchPath)

    const id = getUniqueId()
    // Map of known pathname → 'file' | 'dir' — used for change detection.
    let known = new Map<string, 'file' | 'dir'>()
    let disposed = false

    const handler = async(): Promise<void> => {
      if (disposed) return

      const current = new Map<string, 'file' | 'dir'>()
      await this._scanUncDirectory(watchPath, current)

      // Emit additions.
      const { _preferences } = this
      const eol = _preferences.getPreferredEol() as LineEnding
      const {
        autoGuessEncoding = true,
        trimTrailingNewline = 2,
        autoNormalizeLineEndings = false
      } = _preferences.getAll()

      for (const [p, kind] of current) {
        if (known.has(p)) continue
        if (kind === 'dir') {
          addDir(win, p, type)
        } else {
          await add(win, p, type, eol, autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings)
        }
      }

      // Emit removals.
      for (const [p, kind] of known) {
        if (current.has(p)) continue
        if (kind === 'dir') {
          unlinkDir(win, p, type)
        } else {
          unlink(win, p, type)
        }
      }

      known = current
    }

    // Initial population (fire-and-forget).
    handler().catch(err => log.error('[Watcher] UNC polling handler error:', err))

    const intervalId = setInterval(() => {
      handler().catch(err => log.error('[Watcher] UNC polling handler error:', err))
    }, UNC_POLL_INTERVAL)

    const closeFn = (): void => {
      disposed = true
      clearInterval(intervalId)
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
    }

    this.watchers[id] = {
      win,
      watcher: { close: closeFn },
      pathname: watchPath,
      type,
      close: closeFn
    }

    return closeFn
  }

  /**
   * Recursively walk `dirPath` with readdir ({ withFileTypes: true }) and
   * populate `results` with every markdown file and sub-directory found.
   *
   * Directories whose name would be ignored by the chokidar `ignored` callback
   * (node_modules, .asar) are skipped during the walk rather than filtered out
   * later.
   */
  private async _scanUncDirectory(
    dirPath: string,
    results: Map<string, 'file' | 'dir'>
  ): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fsPromises.readdir(dirPath, { withFileTypes: true })
    } catch (err) {
      log.error('[Watcher] UNC scan — cannot read directory:', dirPath, err)
      return
    }

    for (const entry of entries) {
      // Skip ignored entries in the same way chokidar's `ignored` callback does.
      if (entry.name === 'node_modules' || entry.name.endsWith('.asar')) {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)

      // On WSL2's 9P virtual filesystem the Dirent type flags returned by
      // readdir({ withFileTypes: true }) can be unreliable — isDirectory()
      // may incorrectly return true for regular files (microsoft/WSL#13105).
      // We therefore use the file extension as the primary signal:
      //   - markdown extension  → always a file, regardless of Dirent
      //   - no markdown extension → only recurse if Dirent says directory
      if (hasMarkdownExtension(entry.name)) {
        results.set(fullPath, 'file')
      } else if (entry.isDirectory()) {
        results.set(fullPath, 'dir')
        await this._scanUncDirectory(fullPath, results)
      }
    }
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
    const watchers: (FSWatcher | { close: () => void })[] = []
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
                if (
                  globalThis.MARKTEXT_DEBUG_VERBOSE >= 3
                ) {
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
