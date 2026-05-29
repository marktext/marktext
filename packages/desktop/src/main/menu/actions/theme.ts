import { ipcMain } from 'electron'

export const selectTheme = (theme: string): void => {
  ipcMain.emit('set-user-preference', { theme })
}

export const setFollowSystemTheme = (followSystemTheme: boolean): void => {
  ipcMain.emit('set-user-preference', { followSystemTheme })
}
