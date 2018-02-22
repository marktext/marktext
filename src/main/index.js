'use strict'

import { app, Menu } from 'electron'
import configureMenu from './menus'
import createWindow, { windows } from './createWindow'

const openFilesCache = []

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

const onReady = () => {
  if (openFilesCache.length) {
    openFilesCache.forEach(path => createWindow(path))
    openFilesCache.length = 0 // empty the open file path cache
  } else {
    createWindow()
  }
  const menu = Menu.buildFromTemplate(configureMenu({ app }))
  Menu.setApplicationMenu(menu)
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
