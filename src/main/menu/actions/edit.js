import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { searchFilesAndDir } from '../../utils/imagePathAutoComplement'

ipcMain.on('mt::ask-for-image-auto-path', (e, { pathname, src, id }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!src || typeof src !== 'string') {
    win.webContents.send(`mt::response-of-image-path-${id}`, [])
    return
  }

  if (src.endsWith('/') || src.endsWith('\\') || src.endsWith('.')) {
    return win.webContents.send(`mt::response-of-image-path-${id}`, [])
  }
  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  const dir = path.dirname(fullPath)
  const searchKey = path.basename(fullPath)
  searchFilesAndDir(dir, searchKey)
    .then(files => {
      return win.webContents.send(`mt::response-of-image-path-${id}`, files)
    })
    .catch(err => {
      log.error(err)
      return win.webContents.send(`mt::response-of-image-path-${id}`, [])
    })
})

export const edit = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-edit-action', type)
  }
}

export const nativeCut = win => {
  if (win) {
    win.webContents.cut()
  }
}

export const nativeCopy = win => {
  if (win) {
    win.webContents.copy()
  }
}

export const nativePaste = win => {
  if (win) {
    win.webContents.paste()
  }
}

export const screenshot = win => {
  ipcMain.emit('screen-capture', win)
}

export const lineEnding = (win, lineEnding) => {
  if (win && win.webContents) {
    win.webContents.send('mt::set-line-ending', lineEnding)
  }
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

export const updateSidebarMenu = (applicationMenu, value) => {
  const sideBarMenuItem = applicationMenu.getMenuItemById('sideBarMenuItem')
  sideBarMenuItem.checked = !!value
}
