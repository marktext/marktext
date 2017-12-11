'use strict'

import { app, Menu } from 'electron'
import configureMenu from './configureMenu'
import createWindow, { windows } from './createWindow'

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

const onReady = () => {
  createWindow()
  const menu = Menu.buildFromTemplate(configureMenu({ app }))
  Menu.setApplicationMenu(menu)
}

app.on('ready', onReady)

app.on('window-all-closed', () => {
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
