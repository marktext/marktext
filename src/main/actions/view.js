import { ipcMain, BrowserWindow } from 'electron'
import { getMenuItem } from '../utils'

const HASH = {
  'Source Code Mode': 'sourceCode',
  'Typewriter Mode': 'typewriter',
  'Focus Mode': 'focus'
}

export const typeMode = (win, item, type) => {
  const { checked } = item
  win.webContents.send('AGANI::view', { type, checked })

  if (type === 'sourceCode') {
    const viewMenuItem = getMenuItem('View')
    viewMenuItem.submenu.items.forEach(item => {
      if (/typewriter|focus/.test(HASH[item.label])) {
        item.enabled = !checked
      }
    })
  }
}

export const changeFont = win => {
  win.webContents.send('AGANI::font-setting')
}

ipcMain.on('AGANI::ask-for-mode', e => {
  // format menu
  const viewMenuItem = getMenuItem('View')
  const modes = {}
  viewMenuItem.submenu.items.forEach(item => {
    if (HASH[item.label]) {
      modes[HASH[item.label]] = item.checked
    }
  })
  const win = BrowserWindow.fromWebContents(e.sender)
  win.webContents.send('AGANI::res-for-mode', modes)
})
