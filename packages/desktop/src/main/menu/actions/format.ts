import { type BrowserWindow, type Menu, type MenuItem } from 'electron'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'

const MENU_ID_FORMAT_MAP: Readonly<Record<string, string>> = Object.freeze({
  strongMenuItem: 'strong',
  emphasisMenuItem: 'em',
  underlineMenuItem: 'u',
  superscriptMenuItem: 'sup',
  subscriptMenuItem: 'sub',
  highlightMenuItem: 'mark',
  inlineCodeMenuItem: 'inline_code',
  strikeMenuItem: 'del',
  hyperlinkMenuItem: 'link',
  imageMenuItem: 'image',
  inlineMathMenuItem: 'inline_math'
})

type Win = BrowserWindow | null | undefined

const format = (win: Win, type: string): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-format-action', { type })
  }
}

export const clearFormat = (win: Win): void => {
  format(win, 'clear')
}

export const emphasis = (win: Win): void => {
  format(win, 'em')
}

export const highlight = (win: Win): void => {
  format(win, 'mark')
}

export const hyperlink = (win: Win): void => {
  format(win, 'link')
}

export const image = (win: Win): void => {
  format(win, 'image')
}

export const inlineCode = (win: Win): void => {
  format(win, 'inline_code')
}

export const inlineMath = (win: Win): void => {
  format(win, 'inline_math')
}

export const strikethrough = (win: Win): void => {
  format(win, 'del')
}

export const strong = (win: Win): void => {
  format(win, 'strong')
}

export const subscript = (win: Win): void => {
  format(win, 'sub')
}

export const superscript = (win: Win): void => {
  format(win, 'sup')
}

export const underline = (win: Win): void => {
  format(win, 'u')
}

// --- Commands -------------------------------------------------------------

export const loadFormatCommands = (commandManager: CommandManager): void => {
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
 * @param applicationMenu The application menu instance.
 * @param formats A object map with selected formats.
 */
export const updateFormatMenu = (applicationMenu: Menu, formats: Record<string, boolean>): void => {
  const formatMenuItem: MenuItem = applicationMenu.getMenuItemById('formatMenuItem')!
  formatMenuItem.submenu!.items.forEach((item: MenuItem) => (item.checked = false))
  formatMenuItem.submenu!.items.forEach((item: MenuItem) => {
    if (item.id && formats[MENU_ID_FORMAT_MAP[item.id]!]) {
      item.checked = true
    }
  })
}
