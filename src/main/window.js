import { app, BrowserWindow, screen, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { getOsLineEndingName, loadMarkdownFile, getDefaultTextDirection } from './utils/filesystem'
import appMenu from './menu'
import Watcher from './watcher'
import { isMarkdownFile, isDirectory, normalizeAndResolvePath, log } from './utils'
import { TITLE_BAR_HEIGHT, defaultWinOptions, isLinux } from './config'
import userPreference from './preference'
import { newTab } from './actions/file'

class AppWindow {
  constructor () {
    this.focusedWindowId = -1
    this.windows = new Map()
    this.watcher = new Watcher()
    this.listen()
  }

  listen () {
    // listen for file watch from renderer process eg
    // 1. click file in folder.
    // 2. new tab and save it.
    // 3. close tab(s) need unwatch.
    ipcMain.on('AGANI::file-watch', (e, { pathname, watch }) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (watch) {
        // listen for file `change` and `unlink`
        this.watcher.watch(win, pathname, 'file')
      } else {
        // unlisten for file `change` and `unlink`
        this.watcher.unWatch(win, pathname, 'file')
      }
    })
  }

  ensureWindowPosition (mainWindowState) {
    // "workArea" doesn't work on Linux
    const { bounds, workArea } = screen.getPrimaryDisplay()
    const screenArea = isLinux ? bounds : workArea

    let { x, y, width, height } = mainWindowState
    let center = false
    if (x === undefined || y === undefined) {
      center = true

      // First app start; check whether window size is larger than screen size
      if (screenArea.width < width) width = screenArea.width
      if (screenArea.height < height) height = screenArea.height
    } else {
      center = !screen.getAllDisplays().map(display =>
        x >= display.bounds.x && x <= display.bounds.x + display.bounds.width &&
        y >= display.bounds.y && y <= display.bounds.y + display.bounds.height)
        .some(display => display)
    }
    if (center) {
      // win.center() doesn't work on Linux
      x = Math.max(0, Math.ceil(screenArea.x + (screenArea.width - width) / 2))
      y = Math.max(0, Math.ceil(screenArea.y + (screenArea.height - height) / 2))
    }

    return {
      x,
      y,
      width,
      height
    }
  }

  /**
   * Creates a new editor window.
   *
   * @param {string} [pathname] Path to a file, directory or link.
   * @param {string} [markdown] Markdown content.
   * @param {*} [options] BrowserWindow options.
   */
  createWindow (pathname = null, markdown = '', options = {}) {
    // Ensure path is normalized
    if (pathname) {
      pathname = normalizeAndResolvePath(pathname)
    }

    const { windows } = this
    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = this.ensureWindowPosition(mainWindowState)
    const winOpt = Object.assign({ x, y, width, height }, defaultWinOptions, options)

    // Enable native or custom window
    const { titleBarStyle } = userPreference.getAll()
    if (titleBarStyle === 'custom') {
      winOpt.titleBarStyle = ''
    } else if (titleBarStyle === 'native') {
      winOpt.frame = true
      winOpt.titleBarStyle = ''
    }

    const win = new BrowserWindow(winOpt)
    windows.set(win.id, { win })

    // create a menu for the current window
    appMenu.addWindowMenuWithListener(win)
    if (windows.size === 1) {
      appMenu.setActiveWindow(win.id)
    }

    win.once('ready-to-show', async () => {
      mainWindowState.manage(win)
      win.show()

      // open single markdown file
      if (pathname && isMarkdownFile(pathname)) {
        appMenu.addRecentlyUsedDocument(pathname)
        try {
          this.openFile(win, pathname)
        } catch (err) {
          log(err)
        }
        // open directory / folder
      } else if (pathname && isDirectory(pathname)) {
        appMenu.addRecentlyUsedDocument(pathname)
        this.openFolder(win, pathname)
        // open a window but do not open a file or directory
      } else {
        const lineEnding = getOsLineEndingName()
        const textDirection = getDefaultTextDirection()
        win.webContents.send('AGANI::open-blank-window', {
          lineEnding,
          markdown
        })
        appMenu.updateLineEndingnMenu(lineEnding)
        appMenu.updateTextDirectionMenu(textDirection)
      }
    })

    win.on('focus', () => {
      win.webContents.send('AGANI::window-active-status', { status: true })

      if (win.id !== this.focusedWindowId) {
        this.focusedWindowId = win.id
        win.webContents.send('AGANI::req-update-line-ending-menu')
        win.webContents.send('AGANI::request-for-view-layout')
        win.webContents.send('AGANI::req-update-text-direction-menu')

        // update application menu
        appMenu.setActiveWindow(win.id)
      }
    })

    win.on('blur', () => {
      win.webContents.send('AGANI::window-active-status', { status: false })
    })

    win.on('close', event => { // before closed
      event.preventDefault()
      win.webContents.send('AGANI::ask-for-close')
    })

    // set renderer arguments
    const { codeFontFamily, codeFontSize, theme } = userPreference.getAll()
    // wow, this can be accessesed in renderer process.
    win.stylePrefs = {
      codeFontFamily,
      codeFontSize,
      theme
    }

    const winURL = process.env.NODE_ENV === 'development'
      ? `http://localhost:9091`
      : `file://${__dirname}/index.html`

    win.loadURL(winURL)
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    return win
  }

  openFile = async (win, filePath) => {
    const data = await loadMarkdownFile(filePath)
    const {
      markdown,
      filename,
      pathname,
      isUtf8BomEncoded,
      lineEnding,
      adjustLineEndingOnSave,
      isMixedLineEndings,
      textDirection
    } = data

    appMenu.updateLineEndingnMenu(lineEnding)
    appMenu.updateTextDirectionMenu(textDirection)
    win.webContents.send('AGANI::open-single-file', {
      markdown,
      filename,
      pathname,
      options: {
        isUtf8BomEncoded,
        lineEnding,
        adjustLineEndingOnSave
      }
    })
    // listen for file `change` and `unlink`
    this.watcher.watch(win, filePath, 'file')
    // Notify user about mixed endings
    if (isMixedLineEndings) {
      win.webContents.send('AGANI::show-notification', {
        title: 'Mixed Line Endings',
        type: 'error',
        message: `The document has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
        time: 20000
      })
    }
  }

  newTab (win, filePath) {
    this.watcher.watch(win, filePath, 'file')
    loadMarkdownFile(filePath).then(rawDocument => {
      appMenu.addRecentlyUsedDocument(filePath)
      newTab(win, rawDocument)
    }).catch(err => {
      // TODO: Handle error --> create a end-user error handler.
      console.error('[ERROR] Cannot open file or directory.')
      log(err)
    })
  }

  openFolder (win, pathname) {
    this.watcher.watch(win, pathname, 'dir')
    try {
      win.webContents.send('AGANI::open-project', pathname)
    } catch (err) {
      log(err)
    }
  }

  forceClose (win) {
    if (!win) return
    const { windows } = this
    if (windows.has(win.id)) {
      this.watcher.unWatchWin(win)
      windows.delete(win.id)
    }
    appMenu.removeWindowMenu(win.id)
    win.destroy() // if use win.close(), it will cause a endless loop.
    if (windows.size === 0) {
      app.quit()
    }
  }

  clear () {
    this.watcher.clear()
  }
}

export default new AppWindow()
