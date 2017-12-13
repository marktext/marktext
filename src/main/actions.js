'use strict'

import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import createWindow from './createWindow'
import { EXTENSIONS } from './config'

const watchAndReload = (pathname, win) => { // when i build, and failed.
  // const watcher = chokidar.watch(pathname, {
  //   persistent: true
  // })
  // const filename = path.basename(pathname)
  // watcher.on('change', path => {
  //   fs.readFile(pathname, 'utf-8', (err, file) => {
  //     if (err) return console.log(err)
  //     win.webContents.send('AGANI::file-change', {
  //       file,
  //       filename,
  //       pathname
  //     })
  //   })
  // })
}

ipcMain.on('AGANI:response-file-save', (e, { markdown, pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (pathname) {
    fs.writeFile(pathname, markdown, 'utf-8', err => {
      if (err) console.log('save file failed')
    })
  } else {
    let filePath = dialog.showSaveDialog(win, {
      defaultPath: '~/Untitled.md'
    })
    if (filePath) {
      filePath = filePath.endsWith('.md') ? filePath : `${filePath}.md`
      const filename = path.basename(filePath)
      fs.writeFile(filePath, markdown, 'utf-8', err => {
        if (err) return console.log('save as file failed')
        e.sender.send('AGANI::set-pathname', { pathname: filePath, filename })
      })
      watchAndReload(filePath, win)
    }
  }
})

export const open = win => {
  const filename = dialog.showOpenDialog(win, {
    properties: [ 'openFile' ],
    filters: [{
      name: 'text',
      extensions: EXTENSIONS
    }]
  })
  if (filename && filename[0]) {
    const newWindow = createWindow(filename[0])
    watchAndReload(filename[0], newWindow)
  }
}

export const newFile = () => {
  createWindow()
}

export const save = win => {
  win.webContents.send('AGANI::ask-file-save')
}
