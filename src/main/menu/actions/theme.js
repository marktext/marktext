import { ipcMain } from 'electron'

export const selectTheme = theme => {
  ipcMain.emit('set-user-preference', { theme })
}
