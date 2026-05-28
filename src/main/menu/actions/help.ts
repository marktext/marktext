import { type BrowserWindow } from 'electron'

export const showAboutDialog = (win: BrowserWindow | null | undefined): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::about-dialog')
  }
}
