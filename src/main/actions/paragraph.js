import { Menu, ipcMain } from 'electron'

const getParagraph = () => {
  const menus = Menu.getApplicationMenu()
  return menus.items.filter(menu => menu.label === 'Paragraph')[0]
}

const allCtrl = bool => {
  const paragraphMenuItem = getParagraph()
  paragraphMenuItem.submenu.items.forEach(item => (item.enabled = bool))
}

const disableNoMultiple = () => {
  const paragraphMenuItem = getParagraph()
  const disableLabels = [
    'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
    'Upgrade Heading Level', 'Degrade Heading Level',
    'Table'
  ]
  paragraphMenuItem.submenu.items
    .filter(item => disableLabels.includes(item.label))
    .forEach(item => (item.enabled = false))
}

export const paragraph = (win, type) => {
  win.webContents.send('AGANI::paragraph', { type })
}

ipcMain.on('AGANI::selection-change', (e, { start, end }) => {
  allCtrl(true)
  if (/th|td/.test(start.type) || /th|td/.test(end.type)) {
    allCtrl(false)
  } else if (start.key !== end.key) {
    disableNoMultiple()
  }
})
