import { ipcMain } from 'electron'
import { getMenuItem } from '../utils'

const FORMAT_MAP = {
  'Strong': 'strong',
  'Emphasis': 'em',
  'Inline Code': 'inline_code',
  'Strike': 'del',
  'Hyperlink': 'link',
  'Image': 'image'
}

const selectFormat = formats => {
  const formatMenuItem = getMenuItem('Format')
  formatMenuItem.submenu.items.forEach(item => (item.checked = false))
  formatMenuItem.submenu.items
    .forEach(item => {
      if (formats.some(format => format.type === FORMAT_MAP[item.label])) {
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
