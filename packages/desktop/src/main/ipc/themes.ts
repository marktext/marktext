import { ipcMain } from 'electron'
import { listCustomThemes, importCustomTheme, openThemesFolder } from '../themes'

/** Register IPC handlers for user-imported ("custom") themes. */
export const registerThemeHandlers = (): void => {
  ipcMain.handle('mt::themes::list-custom', () => listCustomThemes())
  ipcMain.handle('mt::themes::import-custom', () => importCustomTheme())
  ipcMain.handle('mt::themes::open-folder', () => openThemesFolder())
}
