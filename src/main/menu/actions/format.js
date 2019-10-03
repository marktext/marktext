const MENU_ID_FORMAT_MAP = {
  strongMenuItem: 'strong',
  emphasisMenuItem: 'em',
  inlineCodeMenuItem: 'inline_code',
  strikeMenuItem: 'del',
  hyperlinkMenuItem: 'link',
  imageMenuItem: 'image',
  mathMenuItem: 'inline_math'
}

export const format = (win, type) => {
  // Fix #961
  // TODO: This is not the best solution for fix #961, but we don't know how to reproduce this issue.
  if (!win) {
    return
  }
  win.webContents.send('AGANI::format', { type })
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

export const updateFormatMenu = (applicationMenu, formats) => {
  const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  formatMenuItem.submenu.items.forEach(item => (item.checked = false))
  formatMenuItem.submenu.items
    .forEach(item => {
      if (item.id && formats.some(format => format.type === MENU_ID_FORMAT_MAP[item.id])) {
        item.checked = true
      }
    })
}
