import * as contextMenu from './actions'
import i18n from '../../../locales'

// NOTE: This are mutable fields that may change at runtime.

export const CUT = {
  label: i18n.t('menu.edit.cut'),
  id: 'cutMenuItem', // not used yet!
  role: 'cut'
}

export const COPY = {
  label: i18n.t('menu.edit.copy'),
  id: 'copyMenuItem',
  role: 'copy'
}

export const PASTE = {
  label: i18n.t('menu.edit.paste'),
  id: 'pasteMenuItem',
  role: 'paste'
}

export const COPY_AS_MARKDOWN = {
  label: i18n.t('menu.edit.copyAsMarkdown'),
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsMarkdown()
  }
}

export const COPY_AS_HTML = {
  label: i18n.t('menu.edit.copyAsHtml'),
  id: 'copyAsHtmlMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsHtml()
  }
}

export const PASTE_AS_PLAIN_TEXT = {
  label: i18n.t('menu.edit.pasteAsPlainText'),
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.pasteAsPlainText()
  }
}

export const INSERT_BEFORE = {
  label: i18n.t('menu.edit.insertParagraphBefore'),
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('before')
  }
}

export const INSERT_AFTER = {
  label: i18n.t('menu.edit.insertParagraphAfter'),
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('after')
  }
}

export const SEPARATOR = {
  type: 'separator'
}
