import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import type { SaveDialogRequest } from '@shared/types/ipc'

export const registerDialogHandlers = (): void => {
  ipcMain.handle('mt::dialog::show-save', async(event, request: SaveDialogRequest) => {
    try {
      const options = {
        title: request?.title,
        defaultPath: request?.defaultPath,
        filters: request?.filters
      }
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)

      return result.canceled ? null : (result.filePath ?? null)
    } catch (err) {
      log.error('dialog.showSaveDialog failed:', err)
      return null
    }
  })
}
