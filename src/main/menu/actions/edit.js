import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { updateLineEndingMenu } from '../../menu'
import { searchFilesAndDir } from '../../utils/imagePathAutoComplement'

ipcMain.on('AGANI::ask-for-image-auto-path', (e, { pathname, src }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (src.endsWith('/') || src.endsWith('\\') || src.endsWith('.')) {
    return win.webContents.send('AGANI::image-auto-path', [])
  }
  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  const dir = path.dirname(fullPath)
  const searchKey = path.basename(fullPath)
  searchFilesAndDir(dir, searchKey)
    .then(files => {
      win.webContents.send('AGANI::image-auto-path', files)
    })
    .catch(log.error)
})

ipcMain.on('AGANI::update-line-ending-menu', (e, lineEnding) => {
  updateLineEndingMenu(lineEnding)
})

export const edit = (win, type) => {
  win.webContents.send('AGANI::edit', { type })
}

export const lineEnding = (win, lineEnding) => {
  win.webContents.send('AGANI::set-line-ending', { lineEnding, ignoreSaveStatus: false })
}
