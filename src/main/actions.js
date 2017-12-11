'use strict'

import fs from 'fs'
import path from 'path'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import createWindow from './createWindow'
import { EXTENSIONS } from './config'

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
        win.setTitle(filename)
        e.sender.send('AGANI::set-pathname', { pathname: filePath })
      })
    }
  }
})

export const open = win => {
  const filename = dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{
      name: 'text',
      extensions: EXTENSIONS
    }]
  })
  createWindow(filename[0])
}

export const newFile = () => {
  createWindow()
}

export const save = win => {
  win.webContents.send('AGANI::ask-file-save')
}
