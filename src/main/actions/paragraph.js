import { ipcMain } from 'electron'
import { getMenuItemById } from '../utils'

const DISABLE_LABELS = [
  // paragraph menu items
  'heading1MenuItem', 'heading2MenuItem', 'heading3MenuItem', 'heading4MenuItem',
  'heading5MenuItem', 'heading6MenuItem',
  'upgradeHeadingMenuItem', 'degradeHeadingMenuItem',
  'tableMenuItem',
  // formats menu items
  'hyperlinkMenuItem', 'imageMenuItem'
]

const MENU_ID_MAP = {
  'heading1MenuItem': 'h1',
  'heading2MenuItem': 'h2',
  'heading3MenuItem': 'h3',
  'heading4MenuItem': 'h4',
  'heading5MenuItem': 'h5',
  'heading6MenuItem': 'h6',
  'tableMenuItem': 'figure',
  'codeFencesMenuItem': 'pre',
  'quoteBlockMenuItem': 'blockquote',
  'orderListMenuItem': 'ol',
  'bulletListMenuItem': 'ul',
  'taskListMenuItem': 'ul',
  'paragraphMenuItem': 'p',
  'horizontalLineMenuItem': 'hr',
  'frontMatterMenuItem': 'pre'
}

const setParagraphMenuItemStatus = bool => {
  const paragraphMenuItem = getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items
    .forEach(item => (item.enabled = bool))
}

const disableNoMultiple = disableLabels => {
  const paragraphMenuItem = getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items
    .filter(item => item.id && disableLabels.includes(item.id))
    .forEach(item => (item.enabled = false))
}

const setCheckedMenuItem = affiliation => {
  const paragraphMenuItem = getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items.forEach(item => (item.checked = false))
  paragraphMenuItem.submenu.items.forEach(item => {
    if (!item.id) {
      return false
    } else if (item.id === 'looseListItemMenuItem') {
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
          return item.id === 'bulletListMenuItem'
        } else {
          return item.id === 'taskListMenuItem'
        }
      } else if (b.type === 'pre' && b.functionType) {
        if (b.functionType === 'frontmatter') {
          return item.id === 'frontMatterMenuItem'
        } else if (/code$/.test(b.functionType)) {
          return item.id === 'codeFencesMenuItem'
        } else if (b.functionType === 'html') {
          return item.id === 'htmlBlockMenuItem'
        } else if (b.functionType === 'multiplemath') {
          return item.id === 'mathBlockMenuItem'
        }
      } else if (b.type === 'figure' && b.functionType) {
        if (b.functionType === 'table') {
          return item.id === 'tableMenuItem'
        }
      } else {
        return b.type === MENU_ID_MAP[item.id]
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
  const formatMenuItem = getMenuItemById('formatMenuItem')
  formatMenuItem.submenu.items.forEach(item => (item.enabled = true))
  // handle menu checked
  setCheckedMenuItem(affiliation)
  // handle disable
  setParagraphMenuItemStatus(true)

  if (
    (/th|td/.test(start.type) && /th|td/.test(end.type)) ||
    (start.type === 'span' && start.block.functionType === 'codeLine') ||
    (end.type === 'span' && end.block.functionType === 'codeLine')
  ) {
    setParagraphMenuItemStatus(false)
  } else if (start.key !== end.key) {
    formatMenuItem.submenu.items
      .filter(item => item.id && DISABLE_LABELS.includes(item.id))
      .forEach(item => (item.enabled = false))
    disableNoMultiple(DISABLE_LABELS)
  } else if (!affiliation.slice(0, 3).some(p => /ul|ol/.test(p.type))) {
    disableNoMultiple(['looseListItemMenuItem'])
  }
})
