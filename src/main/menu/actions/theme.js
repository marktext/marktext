import { ipcMain } from 'electron'
import { updateThemeMenu } from '../index'

export const selectTheme = theme => {
  ipcMain.emit('mt::set-user-preference', undefined, { theme })
}

ipcMain.on('broadcast-preferences-changed', prefs => {
  if (prefs.theme !== undefined) {
    updateThemeMenu(prefs.theme)
  }
})
