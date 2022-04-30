import { COMMANDS } from '../../commands'

const MENU_ID_FORMAT_MAP = Object.freeze({
  strongMenuItem: 'strong',
  emphasisMenuItem: 'em',
  inlineCodeMenuItem: 'inline_code',
  strikeMenuItem: 'del',
  hyperlinkMenuItem: 'link',
  imageMenuItem: 'image',
  inlineMathMenuItem: 'inline_math'
})

const format = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-format-action', { type })
  }
}

export const clearFormat = win => {
  format(win, 'clear')
}

export const emphasis = win => {
  format(win, 'em')
}

export const highlight = win => {
  format(win, 'mark')
}

export const hyperlink = win => {
  format(win, 'link')
}

export const image = win => {
  format(win, 'image')
}

export const inlineCode = win => {
  format(win, 'inline_code')
}

export const inlineMath = win => {
  format(win, 'inline_math')
}

export const strikethrough = win => {
  format(win, 'del')
}

export const strong = win => {
  format(win, 'strong')
}

export const subscript = win => {
  format(win, 'sub')
}

export const superscript = win => {
  format(win, 'sup')
}

export const underline = win => {
  format(win, 'u')
}

// --- Commands -------------------------------------------------------------

export const loadFormatCommands = commandManager => {
  commandManager.add(COMMANDS.FORMAT_CLEAR_FORMAT, clearFormat)
  commandManager.add(COMMANDS.FORMAT_EMPHASIS, emphasis)
  commandManager.add(COMMANDS.FORMAT_HIGHLIGHT, highlight)
  commandManager.add(COMMANDS.FORMAT_HYPERLINK, hyperlink)
  commandManager.add(COMMANDS.FORMAT_IMAGE, image)
  commandManager.add(COMMANDS.FORMAT_INLINE_CODE, inlineCode)
  commandManager.add(COMMANDS.FORMAT_INLINE_MATH, inlineMath)
  commandManager.add(COMMANDS.FORMAT_STRIKE, strikethrough)
  commandManager.add(COMMANDS.FORMAT_STRONG, strong)
  commandManager.add(COMMANDS.FORMAT_SUBSCRIPT, subscript)
  commandManager.add(COMMANDS.FORMAT_SUPERSCRIPT, superscript)
  commandManager.add(COMMANDS.FORMAT_UNDERLINE, underline)
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

/**
 * Update format menu entires from given state.
 *
 * @param {Electron.MenuItem} applicationMenu The application menu instance.
 * @param {Object.<string, boolean>} formats A object map with selected formats.
 */
export const updateFormatMenu = (applicationMenu, formats) => {
  const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  formatMenuItem.submenu.items.forEach(item => (item.checked = false))
  formatMenuItem.submenu.items
    .forEach(item => {
      if (item.id && formats[MENU_ID_FORMAT_MAP[item.id]]) {
        item.checked = true
      }
    })
}
