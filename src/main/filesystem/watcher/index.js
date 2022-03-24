import path from 'path'
import chokidar from 'chokidar'
import log from 'electron-log'
import { WATCHER_CHANGE_TYPE } from 'common/filesystem/watcher'
import { isLinux } from '../../config'
import { getMarkdownDirectoryWatcherConfig, getMarkdownFileWatcherConfig } from './config'
import { normalizeFileChanges } from './eventNormalizer'

const WATCHER_EVENT_QUEUE_DELAY = 100
const WATCHER_TYPE = Object.freeze({
  FILE_MARKDOWN: 0,
  DIRECTORY_SIDEBAR: 1
})

export class Watcher {
  constructor (pathToWatch, config, changeHandler) {
    if (!changeHandler || !changeHandler.handleChanges) {
      throw new Error('Expected callback for changes.')
    }

    this._pathToWatch = path.resolve(pathToWatch)

    this._disposed = false
    this._pendingChanges = []
    this._commitTimer = null
    this._enospcReached = false

    this._cbHandleChanges = changeHandler.handleChanges
    this._cbHandleError = changeHandler.handleError

    this._watcher = this._initWatcher(config)
  }

  destroy () {
    if (!this._disposed) {
      this._disposed = true
      clearTimeout(this._commitTimer)
      this._watcher.close()
    }
  }

  _initWatcher (config) {
    const { _pathToWatch } = this

    const watcher = chokidar.watch(_pathToWatch, config)
    const addModificationTime = config.alwaysStat

    watcher.on('all', (type, fullPath, stat) => {
      // Abort if closed or path isn't absolute.
      if (this._disposed || fullPath.indexOf(this._pathToWatch) < 0) {
        return
      }

      let changeType
      let isDirectory
      let mtime
      switch (type) {
        case 'add':
          changeType = WATCHER_CHANGE_TYPE.CREATED
          isDirectory = false
          if (addModificationTime) {
            mtime = stat.mtime
          }
          break
        case 'change':
          changeType = WATCHER_CHANGE_TYPE.CHANGED
          isDirectory = false
          if (addModificationTime) {
            mtime = stat.mtime
          }
          break
        case 'unlink':
          changeType = WATCHER_CHANGE_TYPE.DELETED
          isDirectory = false
          break
        case 'addDir':
          changeType = WATCHER_CHANGE_TYPE.CREATED
          isDirectory = true
          break
        case 'unlinkDir':
          changeType = WATCHER_CHANGE_TYPE.DELETED
          isDirectory = true
          break
        default:
          console.error('Unsupported watcher type:', type)
          return
      }

      this._pendingChanges.push({
        type: changeType,
        path: fullPath,
        isDirectory,
        mtime
      })

      clearTimeout(this._commitTimer)
      this._commitTimer = setTimeout(() => {
        const queue = this._pendingChanges
        this._pendingChanges = []
        this._handleChanges(queue)
      }, WATCHER_EVENT_QUEUE_DELAY)
    })

    watcher.on('error', error => {
      // Check if too many file descriptors are opened and notify the user about this issue.
      if (error.code === 'ENOSPC') {
        if (!this._enospcReached) {
          this._enospcReached = true
          this.destroy()
          this._emitError('Too many file descriptors are opened: inotify limit reached.', true)
        }
      } else {
        console.error(error)
        this._emitError(`Error while watching files: ${error.message}`, false)
      }
    })

    return watcher
  }

  _handleChanges (pendingChanges) {
    const changes = normalizeFileChanges(pendingChanges)
    this._cbHandleChanges(changes)
  }

  _emitError (message, watcherKilled) {
    if (this._cbHandleError) {
      this._cbHandleError(message, watcherKilled)
    }
  }
}

/** A file watcher for markdown files that is used to notify the editor about changes. */
export class MarkdownFileWatcher extends Watcher {
  constructor (pathToWatch, settings, changeHandler) {
    super(pathToWatch, getMarkdownFileWatcherConfig(settings), changeHandler)
  }
}

/**
 * A directory watcher that notifies the editor about markdown changes in
 * the opened project (sidebar).
 */
export class SideBarDirectoryWatcher extends Watcher {
  constructor (pathToWatch, settings, changeHandler) {
    super(pathToWatch, getMarkdownDirectoryWatcherConfig(settings), changeHandler)
  }
}

class SharedOwner {
  /**
   * @param {import("electron").BrowserWindow} window
   * @param {String} responseUuid
   */
  constructor (window, responseUuid) {
    this._window = window
    this._responseUuid = responseUuid
  }

  get id () {
    return this._window.id
  }

  get responseUuid () {
    return this._responseUuid
  }

  get window () {
    return this._window
  }
}

/**
 * An entry abstracting a filesystem watcher instance.
 *
 * @typedef {Object} WatcherEntry
 * @property {*} type The watcher type (file or directory).
 * @property {String} pathToWatch The path to watch.
 * @property {SharedOwner[]} windowListeners The shared owners of this watcher.
 * @property {Watcher} watcher The watcher instance.
 */

export class WindowWatcherManager {
  constructor () {
    /** @type {WatcherEntry[]} */
    this._watchers = []
  }

  close () {
    for (const watcherEntry of this._watchers) {
      this._destroyWatcher(watcherEntry)
    }
    this._watchers.length = 0
  }

  /**
   * Watches a directory for markdown file changes. All changes are committed via IPC and given `responseUuid`.
   *
   * @param {String} pathToWatch The directory path to watch.
   * @param {import("electron").BrowserWindow} window The editor (window) that want to watch.
   * @param {String} responseUuid A UUID that is attached to responses.
   * @param {*} settings The watcher settings.
   */
  watchDirectory (pathToWatch, window, responseUuid, settings) {
    this._watchPath(pathToWatch, window, responseUuid, settings, WATCHER_TYPE.DIRECTORY_SIDEBAR)
  }

  /**
   * Watches a file for changes. All changes are committed via IPC and given `responseUuid`.
   *
   * @param {String} pathToWatch The file path to watch.
   * @param {import("electron").BrowserWindow} window The editor (window) that want to watch.
   * @param {String} responseUuid A UUID that is attached to responses.
   * @param {*} settings The watcher settings.
   */
  watchFile (fileToWatch, window, responseUuid, settings) {
    this._watchPath(fileToWatch, window, responseUuid, settings, WATCHER_TYPE.FILE_MARKDOWN)
  }

  _watchPath (pathToWatch, window, responseUuid, settings, type) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }

    pathToWatch = path.resolve(pathToWatch)

    const watcherEntry = this._getWatcherByPath(pathToWatch, type)
    if (watcherEntry) {
      watcherEntry.windowListeners.push(new SharedOwner(window, responseUuid))
      return
    }

    const windowListeners = [new SharedOwner(window, responseUuid)]
    const ipcChannel = `mt::watcher-changes-${getWindowWatcherIpcSuffix(type)}`
    const listener = {
      handleChanges: changes => {
        for (const windowInfo of windowListeners) {
          if (!notifyWindowAboutChange(windowInfo, ipcChannel, changes)) {
            this._unwatchPath(pathToWatch, windowInfo.id, type)
          }
        }
      },
      handleError: (errorMessage, killed) => {
        log.error('An error occurred while watching:', errorMessage)
        for (const windowInfo of windowListeners) {
          notifyWindowAboutError(windowInfo, errorMessage, killed)
        }

        if (killed) {
          const watcherEntry = this._getWatcherByPath(pathToWatch, type)
          if (watcherEntry) {
            this._destroyWatcher(watcherEntry)
            this._removeWatcher(watcherEntry)
          }
        }
      }
    }

    let watcher
    switch (type) {
      case WATCHER_TYPE.DIRECTORY_SIDEBAR:
        watcher = new SideBarDirectoryWatcher(pathToWatch, settings, listener)
        break
      case WATCHER_TYPE.FILE_MARKDOWN:
        watcher = new MarkdownFileWatcher(pathToWatch, settings, listener)
        break
      default:
        throw new Error(`Invalid watcher type: ${type}.`)
    }

    this._watchers.push({
      type,
      pathToWatch,
      windowListeners,
      watcher
    })
  }

  /**
   * Unwatch the given directory path that was requested by `windowId`.
   *
   * @param {String} pathToWatch The directory path to unwatch.
   * @param {Number} windowId The owner window id.
   * @returns true on success.
   */
  unwatchDirectory (pathToWatch, windowId) {
    return this._unwatchPath(pathToWatch, windowId, WATCHER_TYPE.DIRECTORY_SIDEBAR)
  }

  /**
   * Unwatch the given file path that was requested by `windowId`.
   *
   * @param {String} pathToWatch The file path to unwatch.
   * @param {Number} windowId The owner window id.
   * @returns true on success.
   */
  unwatchFile (fileToWatch, windowId) {
    return this._unwatchPath(fileToWatch, windowId, WATCHER_TYPE.FILE_MARKDOWN)
  }

  _unwatchPath (pathToWatch, windowId, type) {
    const watcherEntry = this._getWatcherByPath(pathToWatch, type)
    if (!watcherEntry || !hasWindowId(watcherEntry, windowId)) {
      return false
    }
    this._removeWindowFromWatcher(watcherEntry, windowId)
    return true
  }

  /**
   * Close all watchers that the given window watches.
   *
   * @param {Number} windowId The owner window id.
   */
  unwatchByWindowId (windowId) {
    const { _watchers } = this
    const endIndex = _watchers.length - 1
    for (let i = endIndex; i >= 0; --i) {
      const watcherEntry = _watchers[i]
      if (hasWindowId(watcherEntry, windowId)) {
        // Remove the watcher entry if no other owner is registered.
        this._removeWindowFromWatcher(watcherEntry, windowId)
      }
    }
  }

  _removeWindowFromWatcher (watcherEntry, windowId) {
    const { windowListeners } = watcherEntry
    if (windowListeners.length > 1) {
      // Reduce reference counter by removing the shared owner.
      const indexToRemove = windowListeners.findIndex(item => item.id === windowId)
      if (indexToRemove === -1) {
        const windowIds = windowListeners.map(item => item.id)
        console.warn(`Unable to reduce watcher reference counter: missing windowId=${windowId} in owner list (${windowIds}).`)
      } else {
        windowListeners.splice(indexToRemove, 1)
      }
      return
    }

    this._destroyWatcher(watcherEntry)
    this._removeWatcher(watcherEntry)
  }

  _removeWatcher (watcherEntry) {
    const { _watchers } = this
    const indexToRemove = _watchers.findIndex(entry => entry === watcherEntry)
    _watchers.splice(indexToRemove, 1)
  }

  _destroyWatcher (watcherEntry) {
    const { watcher, windowListeners } = watcherEntry
    windowListeners.length = 0
    watcher.destroy()
  }

  _getWatcherByPath (pathToWatch, type) {
    return this._watchers.find(item => item.type === type && this._isPathEqual(item.pathToWatch, pathToWatch))
  }

  _isPathEqual (path1, path2) {
    if (!isLinux) {
      path1 = path1.toLowerCase()
      path2 = path2.toLowerCase()
    }
    return path.resolve(path1) === path.resolve(path2)
  }
}

const notifyWindowAboutChange = (windowInfo, ipcChannel, changes) => {
  const { id, responseUuid, window } = windowInfo
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    console.warn(`Invalid state: Window id=${id} already destroyed but still owner of filesystem watcher.`)
    return false
  }
  window.webContents.send(ipcChannel, responseUuid, changes)
  return true
}

const notifyWindowAboutError = (windowInfo, errorMessage, killed) => {
  const { responseUuid, window } = windowInfo
  if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send('mt::watcher-changes-error', responseUuid, errorMessage, killed)
  }
}

export const getWatcherSettingsFromPreferences = preferences => {
  const {
    watcherUsePolling: usePolling,
    watcherDirectoryDepth: directoryDepth
  } = preferences.getAll()
  return { usePolling, directoryDepth }
}

const getWindowWatcherIpcSuffix = type => {
  switch (type) {
    case WATCHER_TYPE.DIRECTORY_SIDEBAR:
      return 'sidebar'
    case WATCHER_TYPE.FILE_MARKDOWN:
      return 'markdown'
    default:
      throw new Error(`Invalid watcher type: ${type}`)
  }
}

const hasWindowId = (watcherEntry, windowId) => {
  return watcherEntry.windowListeners.findIndex(item => item.id === windowId) !== -1
}
