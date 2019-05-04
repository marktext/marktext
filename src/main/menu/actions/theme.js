import { ipcMain } from 'electron'

export const selectTheme = theme => {
  ipcMain.emit('mt::set-user-preference', undefined, { theme })
}
