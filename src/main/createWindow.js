'use strict'

import path from 'path'
import { app, BrowserWindow, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { getOsLineEndingName, loadMarkdownFile } from './filesystem'
import { addRecentlyUsedDocuments, updateLineEndingnMenu } from './menu'
import { isMarkdownFile } from './utils'

let focusedWindowId = -1
export const windows = new Map()

const ensureWindowPosition = mainWindowState => {
  // "workArea" doesn't work on Linux
  const screenArea = process.platform === 'linux' ? screen.getPrimaryDisplay().bounds : screen.getPrimaryDisplay().workArea
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

const createWindow = (pathname, options = {}) => {
  const TITLE_BAR_HEIGHT = 21
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800
  })

  const { x, y, width, height } = ensureWindowPosition(mainWindowState)
  const winOpt = Object.assign({ x, y, width, height }, {
    icon: path.join(__static, 'logo-96px.png'),
    minWidth: 450,
    minHeight: 220,
    webPreferences: {
      webSecurity: false
    },
    useContentSize: true,
    show: false,
    frame: false,
    titleBarStyle: 'hidden'
  }, options)
  let win = new BrowserWindow(winOpt)
  win.once('ready-to-show', () => {
    mainWindowState.manage(win)
    win.show()

    if (pathname && isMarkdownFile(pathname)) {
      addRecentlyUsedDocuments(pathname)
      loadMarkdownFile(win, pathname)
    } else {
      const lineEnding = getOsLineEndingName()
      win.webContents.send('AGANI::set-line-ending', {
        lineEnding,
        ignoreSaveStatus: true
      })
      updateLineEndingnMenu(lineEnding)
    }
  })

  win.on('focus', () => {
    win.webContents.send('AGANI::window-active-status', { status: true })

    if (win.id !== focusedWindowId) {
      focusedWindowId = win.id
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

export const forceClose = win => {
  if (!win) return
  if (windows.has(win.id)) {
    windows.delete(win.id)
  }
  win.destroy() // if use win.close(), it will cause a endless loop.
  if (windows.size === 0) {
    app.quit()
  }
}

export default createWindow
