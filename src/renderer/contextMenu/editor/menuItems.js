import * as contextMenu from './actions'
import i18n from '../../../locales'

// NOTE: This are mutable fields that may change at runtime.

export const CUT = () => {
  return {
    label: i18n.t('menu.edit.cut'),
    id: 'cutMenuItem', // not used yet!
    role: 'cut'
  }
}

export const COPY = () => {
  return {
    label: i18n.t('menu.edit.copy'),
    id: 'copyMenuItem',
    role: 'copy'
  }
}

export const PASTE = () => {
  return {
    label: i18n.t('menu.edit.paste'),
    id: 'pasteMenuItem',
    role: 'paste'
  }
}

export const COPY_AS_MARKDOWN = () => {
  return {
    label: i18n.t('menu.edit.copyAsMarkdown'),
    id: 'copyAsMarkdownMenuItem',
    click (menuItem, browserWindow) {
      contextMenu.copyAsMarkdown()
    }
  }
}

export const COPY_AS_HTML = () => {
  return {
    label: i18n.t('menu.edit.copyAsHtml'),
    id: 'copyAsHtmlMenuItem',
    click (menuItem, browserWindow) {
      contextMenu.copyAsHtml()
    }
  }
}

export const PASTE_AS_PLAIN_TEXT = () => {
  return {
    label: i18n.t('menu.edit.pasteAsPlainText'),
    id: 'pasteAsPlainTextMenuItem',
    click (menuItem, browserWindow) {
      contextMenu.pasteAsPlainText()
    }
  }
}

export const INSERT_BEFORE = () => {
  return {
    label: i18n.t('menu.edit.insertParagraphBefore'),
    id: 'insertParagraphBeforeMenuItem',
    click (menuItem, browserWindow) {
      contextMenu.insertParagraph('before')
    }
  }
}

export const INSERT_AFTER = () => {
  return {
    label: i18n.t('menu.edit.insertParagraphAfter'),
    id: 'insertParagraphAfterMenuItem',
    click (menuItem, browserWindow) {
      contextMenu.insertParagraph('after')
    }
  }
}

export const SEPARATOR = () => {
  return {
    type: 'separator'
  }
}
