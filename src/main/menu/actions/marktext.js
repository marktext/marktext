import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

let runningUpdate = false
let win = null

autoUpdater.autoDownload = false

autoUpdater.on('error', error => {
  if (win) {
    win.webContents.send('mt::UPDATE_ERROR', error === null ? 'Error: unknown' : (error.message || error).toString())
  }
})

autoUpdater.on('update-available', () => {
  if (win) {
    win.webContents.send('mt::UPDATE_AVAILABLE', 'Found an update, do you want download and install now?')
  }
  runningUpdate = false
})

autoUpdater.on('update-not-available', () => {
  if (win) {
    win.webContents.send('mt::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  runningUpdate = false
})

autoUpdater.on('update-downloaded', () => {
  // TODO: We should ask the user, so that the user can save all documents and
  // not just force close the application.

  if (win) {
    win.webContents.send('mt::UPDATE_DOWNLOADED', 'Update downloaded, application will be quit for update...')
  }
  setImmediate(() => autoUpdater.quitAndInstall())
})

export const userSetting = () => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = browserWindow => {
  if (!runningUpdate) {
    runningUpdate = true
    win = browserWindow
    autoUpdater.checkForUpdates()
  }
}

ipcMain.on('mt::NEED_UPDATE', (e, { needUpdate }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::check-for-update', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  checkUpdates(win)
})
