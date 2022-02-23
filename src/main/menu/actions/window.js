import { ipcMain, Menu } from 'electron'
import { isOsx } from '../../config'

export const minimizeWindow = win => {
  if (win) {
    if (isOsx) {
      Menu.sendActionToFirstResponder('performMiniaturize:')
    } else {
      win.minimize()
    }
  }
}

export const toggleAlwaysOnTop = win => {
  if (win) {
    ipcMain.emit('window-toggle-always-on-top', win)
  }
}
