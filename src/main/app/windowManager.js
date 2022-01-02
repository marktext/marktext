import { app, BrowserWindow, ipcMain } from 'electron'
import EventEmitter from 'events'
import log from 'electron-log'
import Watcher, { WATCHER_STABILITY_THRESHOLD, WATCHER_STABILITY_POLL_INTERVAL } from '../filesystem/watcher'
import { WindowType } from '../windows/base'

class WindowActivityList {
  constructor () {
    // Oldest             Newest
    //  <number>, ... , <number>
    this._buf = []
  }

  getNewest () {
    const { _buf } = this
    if (_buf.length) {
      return _buf[_buf.length - 1]
    }
    return null
  }

  getSecondNewest () {
    const { _buf } = this
    if (_buf.length >= 2) {
      return _buf[_buf.length - 2]
    }
    return null
  }

  setNewest (id) {
    // I think we do not need a linked list for only a few windows.
    const { _buf } = this
    const index = _buf.indexOf(id)
    if (index !== -1) {
      const lastIndex = _buf.length - 1
      if (index === lastIndex) {
        return
      }
      _buf.splice(index, 1)
    }
    _buf.push(id)
  }

  delete (id) {
    const { _buf } = this
    const index = _buf.indexOf(id)
    if (index !== -1) {
      _buf.splice(index, 1)
    }
  }
}

class WindowManager extends EventEmitter {
  /**
   *
   * @param {AppMenu} appMenu The application menu instance.
   * @param {Preference} preferences The preference instance.
   */
  constructor (appMenu, preferences) {
    super()

    this._appMenu = appMenu

    this._activeWindowId = null
    this._windows = new Map()
    this._windowActivity = new WindowActivityList()

    // TODO(need::refactor): Please see #1035.
    this._watcher = new Watcher(preferences)

    this._listenForIpcMain()
  }

  /**
   * Add the given window to the window list.
   *
   * @param {IApplicationWindow} window The application window. We take ownership!
   */
  add (window) {
    const { id: windowId } = window
    this._windows.set(windowId, window)

    if (!this._appMenu.has(windowId)) {
      this._appMenu.addDefaultMenu(windowId)
    }

    if (this.windowCount === 1) {
      this.setActiveWindow(windowId)
    }

    window.on('window-focus', () => {
      this.setActiveWindow(windowId)
    })
    window.on('window-closed', () => {
      this.remove(windowId)
      this._watcher.unwatchByWindowId(windowId)
    })
  }

  /**
   * Return the application window by id.
   *
   * @param {string} windowId The window id.
   * @returns {BaseWindow} The application window or undefined.
   */
  get (windowId) {
    return this._windows.get(windowId)
  }

  /**
   * Return the BrowserWindow by id.
   *
   * @param {string} windowId The window id.
   * @returns {Electron.BrowserWindow} The window or undefined.
   */
  getBrowserWindow (windowId) {
    const window = this.get(windowId)
    if (window) {
      return window.browserWindow
    }
    return undefined
  }

  /**
   * Remove the given window by id.
   *
   * NOTE: All window "window-focus" events listeners are removed!
   *
   * @param {string} windowId The window id.
   * @returns {IApplicationWindow} Returns the application window. We no longer take ownership.
   */
  remove (windowId) {
    const { _windows } = this
    const window = this.get(windowId)
    if (window) {
      window.removeAllListeners('window-focus')

      this._windowActivity.delete(windowId)
      const nextWindowId = this._windowActivity.getNewest()
      this.setActiveWindow(nextWindowId)

      _windows.delete(windowId)
    }
    return window
  }

  setActiveWindow (windowId) {
    if (this._activeWindowId !== windowId) {
      this._activeWindowId = windowId
      this._windowActivity.setNewest(windowId)
      if (windowId != null) {
        // windowId is null when all windows are closed (e.g. when gracefully closed).
        this._appMenu.setActiveWindow(windowId)
      }
      this.emit('activeWindowChanged', windowId)
    }
  }

  /**
   * Returns the active window or null if no window is registered.
   * @returns {BaseWindow|undefined}
   */
  getActiveWindow () {
    return this._windows.get(this._activeWindowId)
  }

  /**
   * Returns the active window id or null if no window is registered.
   * @returns {number|null}
   */
  getActiveWindowId () {
    return this._activeWindowId
  }

  /**
   * Returns the (last) active editor window or null if no editor is registered.
   * @returns {EditorWindow|undefined}
   */
  getActiveEditor () {
    let win = this.getActiveWindow()
    if (win && win.type !== WindowType.EDITOR) {
      win = this._windows.get(this._windowActivity.getSecondNewest())
      if (win && win.type === WindowType.EDITOR) {
        return win
      }
      return undefined
    }
    return win
  }

  /**
   * Returns the (last) active editor window id or null if no editor is registered.
   * @returns {number|null}
   */
  getActiveEditorId () {
    const win = this.getActiveEditor()
    return win ? win.id : null
  }

  /**
   *
   * @param {WindowType} type the WindowType one of ['base', 'editor', 'settings']
   * @returns {{id: number, win: BaseWindow}[]} Return the windows of the given {type}
   */
  getWindowsByType (type) {
    if (!WindowType[type.toUpperCase()]) {
      console.error(`"${type}" is not a valid window type.`)
    }
    const { windows } = this
    const result = []
    for (const [key, value] of windows) {
      if (value.type === type) {
        result.push({
          id: key,
          win: value
        })
      }
    }
    return result
  }

  /**
   * Find the best window to open the files in.
   *
   * @param {string[]} fileList File full paths.
   * @returns {{windowId: string, fileList: string[]}[]} An array of files mapped to a window id or null to open in a new window.
   */
  findBestWindowToOpenIn (fileList) {
    if (!fileList || !Array.isArray(fileList) || !fileList.length) return []
    const { windows } = this
    const lastActiveEditorId = this.getActiveEditorId() // editor id or null

    if (this.windowCount <= 1) {
      return [{ windowId: lastActiveEditorId, fileList }]
    }

    // Array of scores, same order like fileList.
    let filePathScores = null
    for (const window of windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const scores = window.getCandidateScores(fileList)
        if (!filePathScores) {
          filePathScores = scores
        } else {
          const len = filePathScores.length
          for (let i = 0; i < len; ++i) {
            // Update score only if the file is not already opened.
            if (filePathScores[i].score !== -1 && filePathScores[i].score < scores[i].score) {
              filePathScores[i] = scores[i]
            }
          }
        }
      }
    }

    const buf = []
    const len = filePathScores.length
    for (let i = 0; i < len; ++i) {
      let { id: windowId, score } = filePathScores[i]

      if (score === -1) {
        // Skip files that already opened.
        continue
      } else if (score === 0) {
        // There is no best window to open the file(s) in.
        windowId = lastActiveEditorId
      }

      let item = buf.find(w => w.windowId === windowId)
      if (!item) {
        item = { windowId, fileList: [] }
        buf.push(item)
      }
      item.fileList.push(fileList[i])
    }
    return buf
  }

  get windows () {
    return this._windows
  }

  get windowCount () {
    return this._windows.size
  }

  // --- helper ---------------------------------

  closeWatcher () {
    this._watcher.close()
  }

  /**
   * Closes the browser window and associated application window without asking to save documents.
   *
   * @param {Electron.BrowserWindow} browserWindow The browser window.
   */
  forceClose (browserWindow) {
    if (!browserWindow) {
      return false
    }

    const { id: windowId } = browserWindow
    const { _appMenu, _windows } = this

    // Free watchers used by this window
    this._watcher.unwatchByWindowId(windowId)

    // Application clearup and remove listeners
    _appMenu.removeWindowMenu(windowId)
    const window = this.remove(windowId)

    // Destroy window wrapper and browser window
    if (window) {
      window.destroy()
    } else {
      log.error('Something went wrong: Cannot find associated application window!')
      browserWindow.destroy()
    }

    // Quit application on macOS if not windows are opened.
    if (_windows.size === 0) {
      app.quit()
    }
    return true
  }

  /**
   * Closes the application window and associated browser window without asking to save documents.
   *
   * @param {number} windowId The application window or browser window id.
   */
  forceCloseById (windowId) {
    const browserWindow = this.getBrowserWindow(windowId)
    if (browserWindow) {
      return this.forceClose(browserWindow)
    }
    return false
  }

  // --- private --------------------------------

  _listenForIpcMain () {
    // HACK: Don't use this event! Please see #1034 and #1035
    ipcMain.on('mt::window-add-file-path', (e, filePath) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const editor = this.get(win.id)
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    })

    // Force close a BrowserWindow
    ipcMain.on('mt::close-window', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      this.forceClose(win)
    })

    ipcMain.on('mt::open-file', (e, filePath, options) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const editor = this.get(win.id)
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to open file.`)
        return
      }
      editor.openTab(filePath, options, true)
    })

    ipcMain.on('mt::window-tab-closed', (e, pathname) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const editor = this.get(win.id)
      if (editor) {
        editor.removeFromOpenedFiles(pathname)
      }
    })

    ipcMain.on('mt::window-toggle-always-on-top', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    })

    // --- local events ---------------

    ipcMain.on('watcher-unwatch-all-by-id', windowId => {
      this._watcher.unwatchByWindowId(windowId)
    })
    ipcMain.on('watcher-watch-file', (win, filePath) => {
      this._watcher.watch(win, filePath, 'file')
    })
    ipcMain.on('watcher-watch-directory', (win, pathname) => {
      this._watcher.watch(win, pathname, 'dir')
    })
    ipcMain.on('watcher-unwatch-file', (win, filePath) => {
      this._watcher.unwatch(win, filePath, 'file')
    })
    ipcMain.on('watcher-unwatch-directory', (win, pathname) => {
      this._watcher.unwatch(win, pathname, 'dir')
    })

    ipcMain.on('window-add-file-path', (windowId, filePath) => {
      const editor = this.get(windowId)
      if (!editor) {
        log.error(`Cannot find window id "${windowId}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    })
    ipcMain.on('window-change-file-path', (windowId, pathname, oldPathname) => {
      const editor = this.get(windowId)
      if (!editor) {
        log.error(`Cannot find window id "${windowId}" to change file path.`)
        return
      }
      editor.changeOpenedFilePath(pathname, oldPathname)
    })

    ipcMain.on('window-file-saved', (windowId, pathname) => {
      // A changed event is emitted earliest after the stability threshold.
      const duration = WATCHER_STABILITY_THRESHOLD + (WATCHER_STABILITY_POLL_INTERVAL * 2)
      this._watcher.ignoreChangedEvent(windowId, pathname, duration)
    })

    ipcMain.on('window-close-by-id', id => {
      this.forceCloseById(id)
    })
    ipcMain.on('window-reload-by-id', id => {
      const window = this.get(id)
      if (window) {
        window.reload()
      }
    })
    ipcMain.on('window-toggle-always-on-top', win => {
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    })

    ipcMain.on('broadcast-preferences-changed', prefs => {
      // We can not dynamic change the title bar style, so do not need to send it to renderer.
      if (typeof prefs.titleBarStyle !== 'undefined') {
        delete prefs.titleBarStyle
      }
      if (Object.keys(prefs).length > 0) {
        for (const { browserWindow } of this._windows.values()) {
          browserWindow.webContents.send('mt::user-preference', prefs)
        }
      }
    })

    ipcMain.on('broadcast-user-data-changed', userData => {
      for (const { browserWindow } of this._windows.values()) {
        browserWindow.webContents.send('mt::user-preference', userData)
      }
    })
  }
}

export default WindowManager
