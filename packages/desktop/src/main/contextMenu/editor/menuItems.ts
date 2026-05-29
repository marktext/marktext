// NOTE: This are mutable fields that may change at runtime.

import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { t } from '../../i18n'

// Use function form to avoid calling the translation function during module load
export const getCUT = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.cut'),
  id: 'cutMenuItem',
  role: 'cut'
})

export const getCOPY = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.copy'),
  id: 'copyMenuItem',
  role: 'copy'
})

export const getPASTE = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.paste'),
  id: 'pasteMenuItem',
  role: 'paste'
})

export const getCopyAsRich = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.copyAsRich'),
  id: 'copyAsRichMenuItem',
  click(_menuItem, targetWindow) {
    if (targetWindow) {
      ;(targetWindow as BrowserWindow).webContents.send('mt::cm-copy-as-rich')
    }
  }
})

export const getCopyAsHtml = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.copyAsHtml'),
  id: 'copyAsHtmlMenuItem',
  click(_menuItem, targetWindow) {
    if (targetWindow) {
      ;(targetWindow as BrowserWindow).webContents.send('mt::cm-copy-as-html')
    }
  }
})

export const getPasteAsPlainText = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.pasteAsPlainText'),
  id: 'pasteAsPlainTextMenuItem',
  click(_menuItem, targetWindow) {
    if (targetWindow) {
      ;(targetWindow as BrowserWindow).webContents.send('mt::cm-paste-as-plain-text')
    }
  }
})

export const getInsertBefore = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.insertParagraphBefore'),
  id: 'insertParagraphBeforeMenuItem',
  click(_menuItem, targetWindow) {
    if (targetWindow) {
      ;(targetWindow as BrowserWindow).webContents.send('mt::cm-insert-paragraph', 'before')
    }
  }
})

export const getInsertAfter = (): MenuItemConstructorOptions => ({
  label: t('contextMenu.insertParagraphAfter'),
  id: 'insertParagraphAfterMenuItem',
  click(_menuItem, targetWindow) {
    if (targetWindow) {
      ;(targetWindow as BrowserWindow).webContents.send('mt::cm-insert-paragraph', 'after')
    }
  }
})

// Retained for backward compatibility
export const CUT = getCUT()
export const COPY = getCOPY()
export const PASTE = getPASTE()
export const COPY_AS_RICH = getCopyAsRich()
export const COPY_AS_HTML = getCopyAsHtml()
export const PASTE_AS_PLAIN_TEXT = getPasteAsPlainText()
export const INSERT_BEFORE = getInsertBefore()
export const INSERT_AFTER = getInsertAfter()

export const SEPARATOR: MenuItemConstructorOptions = {
  type: 'separator'
}
