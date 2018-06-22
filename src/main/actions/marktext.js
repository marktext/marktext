import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'
import appWindow from '../window'
import userPreference from '../preference'

let updater
let win

autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_ERROR', error === null ? 'Error: unknown' : (error.message || error).toString())
  }
})

ipcMain.on('AGANI::NEED_UPDATE', (e, { needUpdate }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    updater.enabled = true
    updater = null
  }
})

autoUpdater.on('update-available', () => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_AVAILABLE', 'Found updates, do you want update now?')
  }
  updater.enabled = true
  updater = null
})

autoUpdater.on('update-not-available', () => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  updater.enabled = true
  updater = null
})

autoUpdater.on('update-downloaded', () => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_DOWNLOADED', 'Updates downloaded, application will be quit for update...')
  }
  setImmediate(() => autoUpdater.quitAndInstall())
})

export const userSetting = (menuItem, browserWindow) => {
  appWindow.createWindow(userPreference.userDataPath)
}

export const checkUpdates = (menuItem, browserWindow) => {
  updater = menuItem
  win = browserWindow
  updater.enabled = false
  autoUpdater.checkForUpdates()
}
