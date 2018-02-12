import { ipcMain } from 'electron'
import { getMenuItem } from '../utils'

const DISABLE_LABELS = [
  'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
  'Upgrade Heading Level', 'Degrade Heading Level',
  'Table', 'Hyperlink', 'Image'
]

const allCtrl = bool => {
  const paragraphMenuItem = getMenuItem('Paragraph')
  paragraphMenuItem.submenu.items
    .forEach(item => (item.enabled = bool))
}

const disableNoMultiple = () => {
  const paragraphMenuItem = getMenuItem('Paragraph')

  paragraphMenuItem.submenu.items
    .filter(item => DISABLE_LABELS.includes(item.label))
    .forEach(item => (item.enabled = false))
}

export const paragraph = (win, type) => {
  win.webContents.send('AGANI::paragraph', { type })
}

ipcMain.on('AGANI::selection-change', (e, { start, end }) => {
  const formatMenuItem = getMenuItem('Format')
  formatMenuItem.submenu.items.forEach(item => (item.enabled = true))
  allCtrl(true)
  if (/th|td/.test(start.type) || /th|td/.test(end.type)) {
    allCtrl(false)
  } else if (start.key !== end.key) {
    formatMenuItem.submenu.items
      .filter(item => DISABLE_LABELS.includes(item.label))
      .forEach(item => (item.enabled = false))
    disableNoMultiple()
  }
})
