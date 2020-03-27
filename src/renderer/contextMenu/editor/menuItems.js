import * as contextMenu from './actions'

export const CUT = {
  label: 'Cut',
  id: 'cutMenuItem', // not used yet!
  role: 'cut'
}

export const COPY = {
  label: 'Copy',
  id: 'copyMenuItem',
  role: 'copy'
}

export const PASTE = {
  label: 'Paste',
  id: 'pasteMenuItem',
  role: 'paste'
}

export const COPY_AS_MARKDOWN = {
  label: 'Copy As Markdown',
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsMarkdown()
  }
}

export const COPY_AS_HTML = {
  label: 'Copy As Html',
  id: 'copyAsHtmlMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsHtml()
  }
}

export const PASTE_AS_PLAIN_TEXT = {
  label: 'Paste As Plain Text',
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.pasteAsPlainText()
  }
}

export const INSERT_BEFORE = {
  label: 'Insert Paragraph Before',
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('before')
  }
}

export const INSERT_AFTER = {
  label: 'Insert Paragraph After',
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('after')
  }
}

export const SEPARATOR = {
  type: 'separator'
}
