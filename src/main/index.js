'use strict'

import { app, BrowserWindow, Menu } from 'electron'
import configureMenu from './configureMenu'

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 800,
    frame: true,
    show: false,
    center: true,
    useContentSize: true,
    width: 1200
  })

  mainWindow.loadURL(winURL)
  // setTimeout(() => {
  //   const filePathes = dialog.showOpenDialog({
  //     filters: [{
  //       name: 'Text',
  //       extensions: ['md']
  //     }],
  //     properties: ['openFile']
  //   })
  //   console.log(filePathes)
  // }, 2000)

  // setTimeout(() => {
  //   const path = dialog.showSaveDialog(mainWindow, {

  //     message: 'hello'
  //   })
  //   console.log(path)
  // }, 2000)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // mainWindow.setTitle('hello')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  const menu = Menu.buildFromTemplate(configureMenu({ app }))
  Menu.setApplicationMenu(menu)
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
