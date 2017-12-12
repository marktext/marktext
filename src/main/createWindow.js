'use strict'

import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import windowStateKeeper from 'electron-window-state'

export const windows = new Map()

const createWindow = (pathname, options = {}) => {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800
  })

  const { x, y, width, height } = mainWindowState
  const winOpt = Object.assign({ x, y, width, height }, {
    useContentSize: true,
    show: false,
    frame: false,
    titleBarStyle: 'hidden'
  }, options)
  let win = new BrowserWindow(winOpt)

  const winURL = process.env.NODE_ENV === 'development'
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`

  win.loadURL(winURL)

  win.once('ready-to-show', () => {
    win.show()

    if (pathname) {
      console.log(typeof pathname)
      const filename = path.basename(pathname)
      fs.readFile(path.resolve(pathname), 'utf-8', (err, file) => {
        if (err) return console.log(err)
        win.webContents.send('AGANI::file-loaded', {
          file,
          filename,
          pathname
        })

        win.setTitle(filename)
      })
    } else {
      win.setTitle('Untitled')
    }
  })

  win.on('close', () => { // before closed
    if (windows.has(win.id)) {
      windows.delete(win.id)
    }
  })

  windows.set(win.id, win)
}

export default createWindow
