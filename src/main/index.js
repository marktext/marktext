'use strict'

import { app, Menu } from 'electron'
import configureMenu, { dockMenu } from './menus'
import createWindow, { windows } from './createWindow'
// import { autoUpdater } from "electron-updater"

const openFilesCache = []

const onReady = () => {
  if (openFilesCache.length) {
    openFilesCache.forEach(path => createWindow(path))
    openFilesCache.length = 0 // empty the open file path cache
  } else {
    createWindow()
  }
  const menu = Menu.buildFromTemplate(configureMenu({ app }))
  Menu.setApplicationMenu(menu)
  if (process.platform === 'darwin') {
    // app.dock is only for macosx
    app.dock.setMenu(dockMenu)
  }
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
