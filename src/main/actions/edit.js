import path from 'path'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import { IMAGE_EXTENSIONS } from '../config'
import { searchFilesAndDir } from '../utils/imagePathAutoComplement'
import appMenu from '../menu'
import { log } from '../utils'

const getAndSendImagePath = (win, type) => {
  const filename = dialog.showOpenDialog(win, {
    properties: [ 'openFile' ],
    filters: [{
      name: 'Images',
      extensions: IMAGE_EXTENSIONS
    }]
  })
  if (filename && filename[0]) {
    win.webContents.send('AGANI::INSERT_IMAGE', { filename: filename[0], type })
  }
}

ipcMain.on('AGANI::ask-for-insert-image', (e, type) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  getAndSendImagePath(win, type)
})

ipcMain.on('AGANI::ask-for-image-auto-path', (e, { pathname, src }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (src.endsWith('/') || src.endsWith('.')) {
    return win.webContents.send('AGANI::image-auto-path', [])
  }
  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  const dir = path.dirname(fullPath)
  const searchKey = path.basename(fullPath)
  searchFilesAndDir(dir, searchKey)
    .then(files => {
      win.webContents.send('AGANI::image-auto-path', files)
    })
    .catch(log)
})

ipcMain.on('AGANI::update-line-ending-menu', (e, lineEnding) => {
  appMenu.updateLineEndingnMenu(lineEnding)
})

ipcMain.on('AGANI::update-text-direction-menu', (e, textDirection) => {
  appMenu.updateTextDirectionMenu(textDirection)
})

export const edit = (win, type) => {
  win.webContents.send('AGANI::edit', { type })
}

export const lineEnding = (win, lineEnding) => {
  win.webContents.send('AGANI::set-line-ending', { lineEnding, ignoreSaveStatus: false })
}

export const insertImage = (win, type) => {
  if (type === 'absolute' || type === 'relative') {
    getAndSendImagePath(win, type)
  } else {
    win.webContents.send('AGANI::INSERT_IMAGE', { type })
  }
}

export const textDirection = (win, textDirection) => {
  win.webContents.send('AGANI::set-text-direction', { textDirection })
}
