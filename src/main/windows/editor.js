import path from 'path'
import BaseWindow from './base'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import windowStateKeeper from 'electron-window-state'
import { WindowType } from '../app/windowManager'
import { TITLE_BAR_HEIGHT, defaultWinOptions, isLinux, isOsx } from '../config'
import { isDirectory, isMarkdownFile, normalizeAndResolvePath } from '../filesystem'
import { loadMarkdownFile } from '../filesystem/markdown'
import { ensureWindowPosition } from './utils'

class EditorWindow extends BaseWindow {

  /**
   * @param {Accessor} accessor The application accessor for application instances.
   */
  constructor (accessor) {
    super(accessor)
    this.type = WindowType.EDITOR
  }

  /**
   * Creates a new editor window.
   *
   * @param {string} [pathname] Path to a file, directory or link.
   * @param {string} [markdown] Markdown content.
   * @param {*} [options] BrowserWindow options.
   */
  createWindow (pathname = null, markdown = '', options = {}) {
    const { menu: appMenu, env, preferences } = this._accessor

    // Ensure path is normalized
    if (pathname) {
      pathname = normalizeAndResolvePath(pathname)
    }

    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = ensureWindowPosition(mainWindowState)
    const winOptions = Object.assign({ x, y, width, height }, defaultWinOptions, options)
    if (isLinux) {
      winOptions.icon = path.join(__static, 'logo-96px.png')
    }

    // Enable native or custom/frameless window and titlebar
    const { titleBarStyle } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    let win = this.browserWindow = new BrowserWindow(winOptions)
    this.id = win.id

    // Create a menu for the current window
    appMenu.addEditorMenu(win)

    win.once('ready-to-show', async () => {
      mainWindowState.manage(win)
      win.show()

      this.emit('window-ready-to-show')

      if (pathname && isMarkdownFile(pathname)) {
        // Open single markdown file
        appMenu.addRecentlyUsedDocument(pathname)
        this._openFile(pathname)
      } else if (pathname && isDirectory(pathname)) {
        // Open directory / folder
        appMenu.addRecentlyUsedDocument(pathname)
        this.openFolder(pathname)
      } else {
        // Open a blank window
        const lineEnding = preferences.getPreferedEOL()
        win.webContents.send('mt::bootstrap-blank-window', {
          lineEnding,
          markdown
        })
        appMenu.updateLineEndingMenu(lineEnding)
      }
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win.webContents.send('AGANI::window-active-status', { status: true })
    })

    // Lost focus
    win.on('blur', () => {
      this.emit('window-blur')
      win.webContents.send('AGANI::window-active-status', { status: false })
    })

    ;['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(channel => {
      win.on(channel, () => {
        win.webContents.send(`mt::window-${channel}`)
      })
    })

    // Before closed. We cancel the action and ask the editor further instructions.
    win.on('close', event => {
      this.emit('window-close')

      event.preventDefault()
      win.webContents.send('AGANI::ask-for-close')

      // TODO: Close all watchers etc. Should we do this manually or listen to 'quit' event?
    })

    // The window is now destroyed.
    win.on('closed', () => {
      this.emit('window-closed')

      // Free window reference
      win = null
    })

    win.loadURL(this._buildUrlWithSettings(this.id, env, preferences))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    return win
  }

  openTab (filePath, selectTab=true) {
    if (this.quitting) return

    const { browserWindow } = this
    const { menu: appMenu, preferences } = this._accessor

    // Listen for file changed.
    ipcMain.emit('watcher-watch-file', browserWindow, filePath)

    loadMarkdownFile(filePath, preferences.getPreferedEOL()).then(rawDocument => {
      appMenu.addRecentlyUsedDocument(filePath)
      browserWindow.webContents.send('AGANI::new-tab', rawDocument, selectTab)
    }).catch(err => {
      // TODO: Handle error --> create a end-user error handler.
      console.error('[ERROR] Cannot open file or directory.')
      log.error(err)
    })
  }

  openUntitledTab (selectTab=true, markdownString='') {
    if (this.quitting) return

    const { browserWindow } = this
    browserWindow.webContents.send('mt::new-untitled-tab', selectTab, markdownString)
  }

  openFolder (pathname) {
    if (this.quitting) return

    const { browserWindow } = this
    ipcMain.emit('watcher-watch-directory', browserWindow, pathname)
    browserWindow.webContents.send('AGANI::open-project', pathname)
  }

  // --- private ---------------------------------

  // Only called once during window bootstrapping.
  _openFile = async filePath => {
    const { browserWindow } = this
    const { menu: appMenu, preferences } = this._accessor

    const data = await loadMarkdownFile(filePath, preferences.getPreferedEOL())
    const {
      markdown,
      filename,
      pathname,
      encoding,
      lineEnding,
      adjustLineEndingOnSave,
      isMixedLineEndings
    } = data

    appMenu.updateLineEndingMenu(lineEnding)
    browserWindow.webContents.send('mt::bootstrap-window', {
      markdown,
      filename,
      pathname,
      options: {
        encoding,
        lineEnding,
        adjustLineEndingOnSave
      }
    })

    // Listen for file changed.
    ipcMain.emit('watcher-watch-file', browserWindow, filePath)

    // Notify user about mixed endings
    if (isMixedLineEndings) {
      browserWindow.webContents.send('AGANI::show-notification', {
        title: 'Mixed Line Endings',
        type: 'error',
        message: `The document has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
        time: 20000
      })
    }
  }
}

export default EditorWindow
