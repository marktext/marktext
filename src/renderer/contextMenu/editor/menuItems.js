import * as contextMenu from './actions'

export const CUT = Object.freeze({
  label: 'Cut',
  id: 'cutMenuItem', // not used yet!
  role: 'cut'
})

export const COPY = Object.freeze({
  label: 'Copy',
  id: 'copyMenuItem',
  role: 'copy'
})

export const PASTE = Object.freeze({
  label: 'Paste',
  id: 'pasteMenuItem',
  role: 'paste'
})

export const COPY_AS_MARKDOWN = Object.freeze({
  label: 'Copy As Markdown',
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsMarkdown()
  }
})

export const COPY_AS_HTML = Object.freeze({
  label: 'Copy As Html',
  id: 'copyAsHtmlMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copyAsHtml()
  }
})

export const PASTE_AS_PLAIN_TEXT = Object.freeze({
  label: 'Paste as Plain Text',
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.pasteAsPlainText()
  }
})

export const INSERT_BEFORE = Object.freeze({
  label: 'Insert Paragraph Before',
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('before')
  }
})

export const INSERT_AFTER = Object.freeze({
  label: 'Insert Paragraph After',
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.insertParagraph('after')
  }
})

export const SEPARATOR = Object.freeze({
  type: 'separator'
})
