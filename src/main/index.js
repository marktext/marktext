'use strict'

import './globalSetting'
import { app } from 'electron'
import createWindow, { windows } from './createWindow'
import { updateApplicationMenu } from './menu'
import { isMarkdownFile } from './utils'
import { watchers } from './imagePathAutoComplement'

let openFilesCache = []

const onReady = () => {
  if (process.platform !== 'darwin' && process.argv.length >= 2) {
    for (const arg of process.argv) {
      if (isMarkdownFile(arg)) {
        openFilesCache = [arg]
        break
      }
    }
  }
  if (openFilesCache.length) {
    openFilesCache.forEach(path => createWindow(path))
    openFilesCache.length = 0 // empty the open file path cache
  } else {
    createWindow()
  }
  updateApplicationMenu()
}

const openFile = (event, path) => {
  event.preventDefault()
  if (app.isReady()) {
    createWindow(path)
  } else {
    openFilesCache.push(path)
  }
}

app.on('open-file', openFile)

app.on('ready', onReady)

app.on('window-all-closed', () => {
  app.removeListener('open-file', openFile)
  // close all the image path watcher
  for (const watcher of watchers.values()) {
    watcher.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (windows.size === 0) {
    onReady()
  }
})
