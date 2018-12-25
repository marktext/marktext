import path from 'path'
import { app, BrowserWindow, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { getOsLineEndingName, loadMarkdownFile, getDefaultTextDirection } from './utils/filesystem'
import appMenu from './menu'
import Watcher from './watcher'
import { isMarkdownFile, isDirectory, log } from './utils'
import { TITLE_BAR_HEIGHT, defaultWinOptions, isLinux } from './config'
import userPreference from './preference'

class AppWindow {
  constructor () {
    this.focusedWindowId = -1
    this.windows = new Map()
    this.watcher = new Watcher()
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

  createWindow (pathname, markdown = '', options = {}) {
    const { windows } = this
    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = this.ensureWindowPosition(mainWindowState)
    const winOpt = Object.assign({ x, y, width, height }, defaultWinOptions, options)
    const win = new BrowserWindow(winOpt)
    windows.set(win.id, {
      win,
      watchers: []
    })

    // create a menu for the current window
    appMenu.addWindowMenuWithListener(win)
    if (windows.size === 1) {
      appMenu.setActiveWindow(win.id)
    }

    win.once('ready-to-show', async () => {
      mainWindowState.manage(win)
      win.show()

      // open single mrkdown file
      if (pathname && isMarkdownFile(pathname)) {
        appMenu.addRecentlyUsedDocument(pathname)
        loadMarkdownFile(pathname)
          .then(data => {
            const {
              markdown,
              filename,
              pathname,
              isUtf8BomEncoded,
              lineEnding,
              adjustLineEndingOnSave,
              isMixed,
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

            // Notify user about mixed endings
            if (isMixed) {
              win.webContents.send('AGANI::show-notification', {
                title: 'Mixed Line Endings',
                type: 'error',
                message: `The document has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
                time: 20000
              })
            }
          })
          .catch(log)
        // open directory / folder
      } else if (pathname && isDirectory(pathname)) {
        this.openProject(win, pathname)
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
    win.stylePrefs = {
      codeFontFamily,
      codeFontSize,
      theme
    }

    const winURL = process.env.NODE_ENV === 'development'
      ? `http://localhost:9080`
      : `file://${__dirname}/index.html`

    win.loadURL(winURL)
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    return win
  }

  openProject (win, pathname) {
    const unwatcher = this.watcher.watch(win, pathname)
    this.windows.get(win.id).watchers.push(unwatcher)
    try {
      // const tree = await loadProject(pathname)
      win.webContents.send('AGANI::open-project', {
        name: path.basename(pathname),
        pathname
      })
    } catch (err) {
      log(err)
    }
  }

  forceClose (win) {
    if (!win) return
    const { windows } = this
    if (windows.has(win.id)) {
      const { watchers } = windows.get(win.id)
      if (watchers && watchers.length) {
        watchers.forEach(w => w())
      }
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
