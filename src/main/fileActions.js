'use strict'

import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import createWindow, { windows } from './createWindow'
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

const writeFile = (pathname, content, extension, win, e) => {
  if (pathname) {
    pathname = pathname.endsWith(extension) ? pathname : `${pathname}${extension}`
    const filename = path.basename(pathname)
    fs.writeFile(pathname, content, 'utf-8', err => {
      if (err) return console.log('save as file failed')
      // not export
      if (extension === '.md') e.sender.send('AGANI::set-pathname', { pathname, filename })
    })
    watchAndReload(pathname, win)
  }
}

const forceClose = win => {
  if (windows.has(win.id)) {
    windows.delete(win.id)
  }
  win.destroy() // if use win.close(), it will cause a endless loop.
  if (windows.size === 0) {
    app.quit()
  }
}
const handleResponseForExport = (e, { type, content }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let defaultPath = ''
  switch (type) {
    case 'styledHtml':
      defaultPath = `~/Untitled.html`
      break
  }
  const filePath = dialog.showSaveDialog(win, {
    defaultPath
  })
  writeFile(filePath, content, '.html', win, e)
}

const handleResponseForSave = (e, { markdown, pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (pathname) {
    fs.writeFile(pathname, markdown, 'utf-8', err => {
      if (err) console.log('save file failed')
    })
  } else {
    const filePath = dialog.showSaveDialog(win, {
      defaultPath: '~/Untitled.md'
    })
    writeFile(filePath, markdown, '.md', win, e)
  }
}

ipcMain.on('AGANI::response-file-save-as', (e, { markdown, pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let filePath = dialog.showSaveDialog(win, {
    defaultPath: pathname || '~/Untitled.md'
  })
  writeFile(filePath, markdown, win, e)
})

ipcMain.on('AGANI::response-close-confirm', (e, { filename, pathname, markdown }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', 'Cancel', 'Delete'],
    defaultId: 0,
    message: `Do you want to save the changes you made to ${filename}?`,
    detail: `Your changes will be lost if you don't save them.`,
    cancelId: 1,
    noLink: true
  }, index => {
    switch (index) {
      case 2:
        forceClose(win)
        break
      case 0:
        setTimeout(() => {
          handleResponseForSave(e, { pathname, markdown })
        })
        break
    }
  })
})

ipcMain.on('AGANI::response-file-save', handleResponseForSave)
ipcMain.on('AGANI::response-export', handleResponseForExport)

ipcMain.on('AGANI::close-window', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  forceClose(win)
})

export const exportStyledHTML = win => {
  win.webContents.send('AGANI::export', { type: 'styledHtml' })
}

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

export const saveAs = win => {
  win.webContents.send('AGANI::ask-file-save-as')
}
