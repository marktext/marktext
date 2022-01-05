import { ipcMain } from 'electron'

export const toggleAlwaysOnTop = win => {
  if (win) {
    ipcMain.emit('window-toggle-always-on-top', win)
  }
}
