import { app, BrowserWindow, ipcMain } from 'electron'
import type { BrowserWindow as IBrowserWindow } from 'electron'
import log from 'electron-log'
import { TypedEmitter } from '@shared/types/typedEmitter'
import Watcher, {
  WATCHER_STABILITY_THRESHOLD,
  WATCHER_STABILITY_POLL_INTERVAL
} from '../filesystem/watcher'
import { onInternalChannel } from '../utils/internalIpc'
import type BaseWindow from '../windows/base'
import type Preference from '../preferences'
import { WindowType } from '../windows/base'
import type { WindowTypeValue } from '../windows/base'
import type EditorWindow from '../windows/editor'

class WindowActivityList {
  // Oldest             Newest
  //  <number>, ... , <number>
  private _buf: number[] = []

  getNewest(): number | null {
    const { _buf } = this
    if (_buf.length) {
      return _buf[_buf.length - 1]
    }
    return null
  }

  getSecondNewest(): number | null {
    const { _buf } = this
    if (_buf.length >= 2) {
      return _buf[_buf.length - 2]
    }
    return null
  }

  setNewest(id: number | null): void {
    if (id == null) return
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

  delete(id: number): void {
    const { _buf } = this
    const index = _buf.indexOf(id)
    if (index !== -1) {
      _buf.splice(index, 1)
    }
  }
}

/**
 * Event payload map for `WindowManager`. The `activeWindowChanged` event is
 * dispatched whenever the focused (or otherwise active) window switches; the
 * payload is the new active window id (or `null` when no windows remain).
 */
export interface WindowManagerEvents {
  activeWindowChanged: [windowId: number | null]
}

interface AppMenuLike {
  has(windowId: number): boolean
  addDefaultMenu(windowId: number): void
  setActiveWindow(windowId: number): void
  removeWindowMenu(windowId: number): void
  updateAlwaysOnTopMenu(windowId: number, flag: boolean): void
}

interface EditorBufferStoreLike {
  handleClose(
    restoreBufferId: string | undefined,
    windows: { id: number; win: BaseWindow }[]
  ): void
}

class WindowManager extends TypedEmitter<WindowManagerEvents> {
  private _appMenu: AppMenuLike
  private _activeWindowId: number | null
  private _windows: Map<number, BaseWindow>
  private _windowActivity: WindowActivityList
  public editorBufferStore: EditorBufferStoreLike
  private _watcher: Watcher

  /**
   * @param appMenu The application menu instance.
   * @param preferences The preference instance.
   * @param editorBufferStore The editor buffer store.
   */
  constructor(
    appMenu: AppMenuLike,
    preferences: Preference,
    editorBufferStore: EditorBufferStoreLike
  ) {
    super()

    this._appMenu = appMenu

    this._activeWindowId = null
    this._windows = new Map()
    this._windowActivity = new WindowActivityList()
    this.editorBufferStore = editorBufferStore

    // TODO(need::refactor): Please see #1035.
    this._watcher = new Watcher(preferences)

    this._listenForIpcMain()
  }

  /**
   * Add the given window to the window list.
   */
  add(window: BaseWindow): void {
    const windowId = window.id as number
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
   */
  get(windowId: number | null): BaseWindow | undefined {
    if (windowId == null) return undefined
    return this._windows.get(windowId)
  }

  /**
   * Return the BrowserWindow by id.
   */
  getBrowserWindow(windowId: number): IBrowserWindow | undefined {
    const window = this.get(windowId)
    if (window) {
      return window.browserWindow ?? undefined
    }
    return undefined
  }

  /**
   * Remove the given window by id.
   *
   * NOTE: All window "window-focus" events listeners are removed!
   */
  remove(windowId: number): BaseWindow | undefined {
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

  setActiveWindow(windowId: number | null): void {
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
   * Returns the active window or undefined if no window is registered.
   */
  getActiveWindow(): BaseWindow | undefined {
    if (this._activeWindowId == null) return undefined
    return this._windows.get(this._activeWindowId)
  }

  /**
   * Returns the active window id or null if no window is registered.
   */
  getActiveWindowId(): number | null {
    return this._activeWindowId
  }

  /**
   * Returns the (last) active editor window or undefined if no editor is registered.
   */
  getActiveEditor(): BaseWindow | undefined {
    let win = this.getActiveWindow()
    if (win && win.type !== WindowType.EDITOR) {
      const secondNewest = this._windowActivity.getSecondNewest()
      win = secondNewest != null ? this._windows.get(secondNewest) : undefined
      if (win && win.type === WindowType.EDITOR) {
        return win
      }
      return undefined
    }
    return win
  }

  /**
   * Returns the (last) active editor window id or null if no editor is registered.
   */
  getActiveEditorId(): number | null {
    const win = this.getActiveEditor()
    return win ? (win.id as number) : null
  }

  /**
   * Returns the windows of the given {type}.
   */
  getWindowsByType(type: WindowTypeValue): { id: number; win: BaseWindow }[] {
    const upper = type.toUpperCase() as keyof typeof WindowType
    if (!WindowType[upper]) {
      console.error(`"${type}" is not a valid window type.`)
    }
    const { windows } = this
    const result: { id: number; win: BaseWindow }[] = []
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
   */
  findBestWindowToOpenIn(fileList: string[]): { windowId: number | null; fileList: string[] }[] {
    if (!fileList || !Array.isArray(fileList) || !fileList.length) return []
    const { windows } = this
    const lastActiveEditorId = this.getActiveEditorId() // editor id or null

    if (this.windowCount <= 1) {
      return [{ windowId: lastActiveEditorId, fileList }]
    }

    // Array of scores, same order like fileList.
    let filePathScores: { id: number | null; score: number }[] | null = null
    for (const window of windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const scores = (window as EditorWindow).getCandidateScores(fileList)
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

    const buf: { windowId: number | null; fileList: string[] }[] = []
    const len = filePathScores!.length
    for (let i = 0; i < len; ++i) {
      let { id: windowId, score } = filePathScores![i]

      if (score === -1) {
        // Skip files that already opened.
        continue
      } else if (score === 0) {
        // There is no best window to open the file(s) in.
        windowId = lastActiveEditorId
      }

      let item = buf.find((w) => w.windowId === windowId)
      if (!item) {
        item = { windowId, fileList: [] }
        buf.push(item)
      }
      item.fileList.push(fileList[i])
    }
    return buf
  }

  get windows(): Map<number, BaseWindow> {
    return this._windows
  }

  get windowCount(): number {
    return this._windows.size
  }

  // --- helper ---------------------------------

  closeWatcher(): void {
    this._watcher.close()
  }

  /**
   * Closes the browser window and associated application window without asking to save documents.
   */
  forceClose(browserWindow: IBrowserWindow | null | undefined): boolean {
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
   */
  forceCloseById(windowId: number): boolean {
    const browserWindow = this.getBrowserWindow(windowId)
    if (browserWindow) {
      return this.forceClose(browserWindow)
    }
    return false
  }

  // --- private --------------------------------

  private _listenForIpcMain(): void {
    // HACK: Don't use this event! Please see #1034 and #1035
    ipcMain.on('mt::window-add-file-path', (e, filePath: string) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const editor = this.get(win.id) as EditorWindow | undefined
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    })

    // Force close a BrowserWindow
    ipcMain.on('mt::close-window', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      // Before closing, update the buffer store if needed
      this.editorBufferStore.handleClose(
        (win as unknown as { restoreBufferId?: string })?.restoreBufferId,
        this.getWindowsByType('editor')
      )
      this.forceClose(win)
    })

    ipcMain.on('mt::open-file', (e, filePath: string, options: Record<string, unknown>) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const editor = this.get(win.id) as EditorWindow | undefined
      if (!editor) {
        log.error(`Cannot find window id "${win.id}" to open file.`)
        return
      }
      editor.openTab(filePath, options, true)
    })

    ipcMain.on('mt::window-tab-closed', (e, pathname: string) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const editor = this.get(win.id) as EditorWindow | undefined
      if (editor) {
        editor.removeFromOpenedFiles(pathname)
      }
    })

    ipcMain.on('mt::window-toggle-always-on-top', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    })

    // --- local events ---------------

    onInternalChannel('watcher-unwatch-all-by-id', (windowId: number) => {
      this._watcher.unwatchByWindowId(windowId)
    })
    onInternalChannel('watcher-watch-file', (win: IBrowserWindow, filePath: string) => {
      this._watcher.watch(win, filePath, 'file')
    })
    onInternalChannel('watcher-watch-directory', (win: IBrowserWindow, pathname: string) => {
      this._watcher.watch(win, pathname, 'dir')
    })
    onInternalChannel('watcher-unwatch-file', (win: IBrowserWindow, filePath: string) => {
      this._watcher.unwatch(win, filePath, 'file')
    })
    onInternalChannel('watcher-unwatch-directory', (win: IBrowserWindow, pathname: string) => {
      this._watcher.unwatch(win, pathname, 'dir')
    })

    onInternalChannel('window-add-file-path', (windowId: number, filePath: string) => {
      const editor = this.get(windowId) as EditorWindow | undefined
      if (!editor) {
        log.error(`Cannot find window id "${windowId}" to add opened file.`)
        return
      }
      editor.addToOpenedFiles(filePath)
    })
    onInternalChannel(
      'window-change-file-path',
      (windowId: number, pathname: string, oldPathname: string) => {
        const editor = this.get(windowId) as EditorWindow | undefined
        if (!editor) {
          log.error(`Cannot find window id "${windowId}" to change file path.`)
          return
        }
        editor.changeOpenedFilePath(pathname, oldPathname)
      }
    )

    onInternalChannel('window-file-saved', (windowId: number, pathname: string) => {
      // A changed event is emitted earliest after the stability threshold.
      const duration = WATCHER_STABILITY_THRESHOLD + WATCHER_STABILITY_POLL_INTERVAL * 2
      this._watcher.ignoreChangedEvent(windowId, pathname, duration)
    })

    onInternalChannel('window-close-by-id', (id: number) => {
      this.forceCloseById(id)
    })
    onInternalChannel('window-reload-by-id', (id: number) => {
      const window = this.get(id)
      if (window) {
        window.reload()
      }
    })
    onInternalChannel('window-toggle-always-on-top', (win: IBrowserWindow) => {
      const flag = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(flag)
      this._appMenu.updateAlwaysOnTopMenu(win.id, flag)
    })

    onInternalChannel('broadcast-preferences-changed', (prefs: Record<string, unknown>) => {
      // We can not dynamic change the title bar style, so do not need to send it to renderer.
      if (typeof prefs.titleBarStyle !== 'undefined') {
        delete prefs.titleBarStyle
      }
      if (Object.keys(prefs).length > 0) {
        for (const { browserWindow } of this._windows.values()) {
          browserWindow?.webContents.send('mt::user-preference', prefs)
        }
      }
    })

    onInternalChannel('broadcast-user-data-changed', (userData: Record<string, unknown>) => {
      for (const { browserWindow } of this._windows.values()) {
        browserWindow?.webContents.send('mt::user-preference', userData)
      }
    })
  }
}

export default WindowManager
