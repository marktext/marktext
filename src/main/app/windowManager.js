import { app, BrowserWindow, ipcMain } from 'electron'
import EventEmitter from 'events'
import log from 'electron-log'
import Watcher from '../filesystem/watcher'

/**
 * A Mark Text window.
 * @typedef {EditorWindow} IApplicationWindow
 * @property {number | null} id Identifier (= browserWindow.id) or null during initialization.
 * @property {Electron.BrowserWindow} browserWindow The browse window.
 * @property {WindowType} type The window type.
 */

// Window type marktext support.
export const WindowType = {
  BASE: 'base', // You shold never create a `BASE` window.
  EDITOR: 'editor',
  SETTING: 'setting'
}

class WindowActivityList {
  constructor() {
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
    const index = _buf.indexOf(id);
    if (index !== -1) {
      _buf.splice(index, 1);
    }
  }
}

class WindowManager extends EventEmitter {

  /**
   *
   * @param {AppMenu} appMenu The application menu instance.
   * @param {Preference} preferences The preference instance.
   */
  constructor(appMenu, preferences) {
    super()

    this._appMenu = appMenu

    this._activeWindowId = null
    this._windows = new Map()
    this._windowActivity = new WindowActivityList()

    // TODO(need::refactor): We should move watcher and search into another process/thread(?)
    this._watcher = new Watcher(preferences)

    this._listenForIpcMain()
  }

  /**
   * Add the given window to the window list.
   *
   * @param {IApplicationWindow} window The application window. We take ownership!
   */
  add (window) {
    this._windows.set(window.id, window)

    if (!this._appMenu.has(window.id)) {
      this._appMenu.addDefaultMenu(window.id)
    }

    if (this.windowCount === 1) {
      this.setActiveWindow(window.id)
    }

    const { browserWindow } = window
    window.on('window-focus', () => {
      this.setActiveWindow(browserWindow.id)
    })
  }

  /**
   * Return the application window by id.
   *
   * @param {string} windowId The window id.
   * @returns {IApplicationWindow} The application window or undefined.
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
   * NOTE: All window event listeners are removed!
   *
   * @param {string} windowId The window id.
   * @returns {IApplicationWindow} Returns the application window. We no longer take ownership.
   */
  remove (windowId) {
    const { _windows } = this
    const window = this.get(windowId)
    if (window) {
      window.removeAllListeners()

      this._windowActivity.delete(windowId)
      let nextWindowId = this._windowActivity.getNewest()
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
   * Returns the active window id or null if no window is registred.
   * @returns {number|null}
   */
  getActiveWindow () {
    return this._activeWindowId
  }

  get windows () {
    return this._windows
  }

  get windowCount () {
    return this._windows.size
  }

  /**
   * 
   * @param {type} type the WindowType one of ['base', 'editor', 'setting']
   * Return the windows of the given {type}
   */
  windowsOfType (type) {
    if (!WindowType[type.toUpperCase()]) {
      console.error(`${type} is not a valid window type.`)
    }
    const { windows } = this
    const result = []
    for (var [key, value] of windows) {
      if (value.type === type) {
        result.push({
          id: key,
          win: value
        })
      }
    }
    return result
  }

  // --- helper ---------------------------------

  closeWatcher () {
    this._watcher.clear()
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

    const { id } = browserWindow
    const { _appMenu, _windows } = this

    // Free watchers used by this window
    this._watcher.unWatchWin(browserWindow)

    // Application clearup and remove listeners
    _appMenu.removeWindowMenu(id)
    const window = this.remove(id)

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

  // --- events ---------------------------------

  _listenForIpcMain () {
    // listen for file watch from renderer process eg
    // 1. click file in folder.
    // 2. new tab and save it.
    // 3. close tab(s) need unwatch.
    ipcMain.on('AGANI::file-watch', (e, { pathname, watch }) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (watch) {
        // listen for file `change` and `unlink`
        this._watcher.watch(win, pathname, 'file')
      } else {
        // unlisten for file `change` and `unlink`
        this._watcher.unWatch(win, pathname, 'file')
      }
    })

    // Force close a BrowserWindow
    ipcMain.on('AGANI::close-window', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      this.forceClose(win)
    })

    // --- local events ---------------

    ipcMain.on('watcher-watch-file', (win, filePath) => {
      this._watcher.watch(win, filePath, 'file')
    })
    ipcMain.on('watcher-watch-directory', (win, pathname) => {
      this._watcher.watch(win, pathname, 'dir')
    })
    ipcMain.on('watcher-unwatch-file', (win, filePath) => {
      this._watcher.unWatch(win, filePath, 'file')
    })
    ipcMain.on('watcher-unwatch-directory', (win, pathname) => {
      this._watcher.unWatch(win, pathname, 'dir')
    })

    // Force close a window by id.
    ipcMain.on('window-close-by-id', id => {
      this.forceCloseById(id)
    })

    ipcMain.on('window-toggle-always-on-top', win => {
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(flag)
    })

    ipcMain.on('broadcast-preferences-changed', prefs => {
      // We can not dynamic change the title bar style, so do not need to send it to renderer.
      if (typeof prefs.titleBarStyle !== 'undefined') {
        delete prefs.titleBarStyle
      }
      if (Object.keys(prefs).length > 0) {
        for (const { browserWindow } of this._windows.values()) {
          browserWindow.webContents.send('AGANI::user-preference', prefs)
        }
      }
    })
  }
}

export default WindowManager
