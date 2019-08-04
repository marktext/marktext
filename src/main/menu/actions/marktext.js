import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

let updaterMenuItem = null
let win = null

autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_ERROR', error === null ? 'Error: unknown' : (error.message || error).toString())
  }
})

ipcMain.on('AGANI::NEED_UPDATE', (e, { needUpdate }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else if (updaterMenuItem) {
    updaterMenuItem.enabled = true
    updaterMenuItem = null
  }
})

autoUpdater.on('update-available', () => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_AVAILABLE', 'Found an update, do you want download and install now?')
  }
  updaterMenuItem.enabled = true
  updaterMenuItem = null
})

autoUpdater.on('update-not-available', () => {
  if (win) {
    win.webContents.send('AGANI::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  updaterMenuItem.enabled = true
  updaterMenuItem = null
})

autoUpdater.on('update-downloaded', () => {
  // TODO: We should ask the user, so that the user can save all documents and
  // not just force close the application.

  if (win) {
    win.webContents.send('AGANI::UPDATE_DOWNLOADED', 'Update downloaded, application will be quit for update...')
  }
  setImmediate(() => autoUpdater.quitAndInstall())
})

export const userSetting = (menuItem, browserWindow) => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = (menuItem, browserWindow) => {
  updaterMenuItem = menuItem
  updaterMenuItem.enabled = false
  win = browserWindow
  autoUpdater.checkForUpdates()
}
