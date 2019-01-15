import { ipcMain } from 'electron'
import { getMenuItemById } from '../utils'

const MENU_ID_FORMAT_MAP = {
  'strongMenuItem': 'strong',
  'emphasisMenuItem': 'em',
  'inlineCodeMenuItem': 'inline_code',
  'strikeMenuItem': 'del',
  'hyperlinkMenuItem': 'link',
  'imageMenuItem': 'image',
  'mathMenuItem': 'inline_math'
}

const selectFormat = formats => {
  const formatMenuItem = getMenuItemById('formatMenuItem')
  formatMenuItem.submenu.items.forEach(item => (item.checked = false))
  formatMenuItem.submenu.items
    .forEach(item => {
      if (item.id && formats.some(format => format.type === MENU_ID_FORMAT_MAP[item.id])) {
        item.checked = true
      }
    })
}

export const format = (win, type) => {
  win.webContents.send('AGANI::format', { type })
}

ipcMain.on('AGANI::selection-formats', (e, formats) => {
  selectFormat(formats)
})
