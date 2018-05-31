import { app, BrowserWindow, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { getOsLineEndingName, loadMarkdownFile } from './utils/filesystem'
import appMenu from './menu'
import { isMarkdownFile } from './utils'
import { TITLE_BAR_HEIGHT, defaultWinOptions, isLinux } from './config'

class AppWindow {
  constructor () {
    this.focusedWindowId = -1
    this.windows = new Map()
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

  createWindow (pathname, options = {}) {
    const { focusedWindowId, windows } = this
    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = this.ensureWindowPosition(mainWindowState)
    const winOpt = Object.assign({ x, y, width, height }, defaultWinOptions, options)
    const win = new BrowserWindow(winOpt)

    win.once('ready-to-show', () => {
      mainWindowState.manage(win)
      win.show()

      if (pathname && isMarkdownFile(pathname)) {
        appMenu.addRecentlyUsedDocument(pathname)
        loadMarkdownFile(win, pathname)
      } else {
        const lineEnding = getOsLineEndingName()
        win.webContents.send('AGANI::set-line-ending', {
          lineEnding,
          ignoreSaveStatus: true
        })
        appMenu.updateLineEndingnMenu(lineEnding)
      }
    })

    win.on('focus', () => {
      win.webContents.send('AGANI::window-active-status', { status: true })

      if (win.id !== focusedWindowId) {
        this.focusedWindowId = win.id
        win.webContents.send('AGANI::req-update-line-ending-menu')
      }
    })

    win.on('blur', () => {
      win.webContents.send('AGANI::window-active-status', { status: false })
    })

    win.on('close', event => { // before closed
      event.preventDefault()
      win.webContents.send('AGANI::ask-for-close')
    })

    const winURL = process.env.NODE_ENV === 'development'
      ? `http://localhost:9080`
      : `file://${__dirname}/index.html`

    win.loadURL(winURL)
    win.setSheetOffset(TITLE_BAR_HEIGHT) // 21 is the title bar height

    windows.set(win.id, win)
    return win
  }

  forceClose (win) {
    if (!win) return
    const { windows } = this
    if (windows.has(win.id)) {
      windows.delete(win.id)
    }
    win.destroy() // if use win.close(), it will cause a endless loop.
    if (windows.size === 0) {
      app.quit()
    }
  }
}

export default new AppWindow()
