// NOTE: This are mutable fields that may change at runtime.

export const CUT = {
  label: 'Cut',
  id: 'cutMenuItem',
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
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-markdown')
  }
}

export const COPY_AS_HTML = {
  label: 'Copy As Html',
  id: 'copyAsHtmlMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-html')
  }
}

export const PASTE_AS_PLAIN_TEXT = {
  label: 'Paste as Plain Text',
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-paste-as-plain-text')
  }
}

export const INSERT_BEFORE = {
  label: 'Insert Paragraph Before',
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'before')
  }
}

export const INSERT_AFTER = {
  label: 'Insert Paragraph After',
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'after')
  }
}

export const SEPARATOR = {
  type: 'separator'
}
