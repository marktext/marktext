import { ipcMain } from 'electron'
import { getMenuItem } from '../utils'

const DISABLE_LABELS = [
  // paragraph menu items
  'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
  'Upgrade Heading Level', 'Degrade Heading Level',
  'Table',
  // formats menu items
  'Hyperlink', 'Image'
]

const LABEL_MAP = {
  'Heading 1': 'h1',
  'Heading 2': 'h2',
  'Heading 3': 'h3',
  'Heading 4': 'h4',
  'Heading 5': 'h5',
  'Heading 6': 'h6',
  'Table': 'figure',
  'Code Fences': 'pre',
  'Quote Block': 'blockquote',
  'Order List': 'ol',
  'Bullet List': 'ul',
  'Task List': 'ul',
  'Paragraph': 'p',
  'Horizontal Line': 'hr'
}

const setParagraphMenuItemStatus = bool => {
  const paragraphMenuItem = getMenuItem('Paragraph')
  paragraphMenuItem.submenu.items
    .forEach(item => (item.enabled = bool))
}

const disableNoMultiple = (disableLabels) => {
  const paragraphMenuItem = getMenuItem('Paragraph')

  paragraphMenuItem.submenu.items
    .filter(item => disableLabels.includes(item.label))
    .forEach(item => (item.enabled = false))
}

const setCheckedMenuItem = affiliation => {
  const paragraphMenuItem = getMenuItem('Paragraph')
  paragraphMenuItem.submenu.items.forEach(item => (item.checked = false))
  paragraphMenuItem.submenu.items.forEach(item => {
    if (item.label === 'Loose List Item') {
      let checked = false
      if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
        checked = affiliation[0].children[0].isLooseListItem
      } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
        checked = affiliation[1].isLooseListItem
      }
      item.checked = checked
    } else if (affiliation.some(b => {
      if (b.type === 'ul') {
        if (b.listType === 'bullet') {
          return item.label === 'Bullet List'
        } else {
          return item.label === 'Task List'
        }
      } else {
        return b.type === LABEL_MAP[item.label]
      }
    })) {
      item.checked = true
    }
  })
}

export const paragraph = (win, type) => {
  win.webContents.send('AGANI::paragraph', { type })
}

ipcMain.on('AGANI::selection-change', (e, { start, end, affiliation }) => {
  // format menu
  const formatMenuItem = getMenuItem('Format')
  formatMenuItem.submenu.items.forEach(item => (item.enabled = true))
  // handle menu checked
  setCheckedMenuItem(affiliation)
  // handle disable
  setParagraphMenuItemStatus(true)
  if (/th|td/.test(start.type) && /th|td/.test(end.type)) {
    setParagraphMenuItemStatus(false)
  } else if (start.key !== end.key) {
    formatMenuItem.submenu.items
      .filter(item => DISABLE_LABELS.includes(item.label))
      .forEach(item => (item.enabled = false))
    disableNoMultiple(DISABLE_LABELS)
  } else if (!affiliation.slice(0, 3).some(p => /ul|ol/.test(p.type))) {
    disableNoMultiple(['Loose List Item'])
  }
})
