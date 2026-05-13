// NOTE: This are mutable fields that may change at runtime.

export const cutMenuItem = t => ({
  label: t('Cut'),
  id: 'cutMenuItem',
  role: 'cut'
})

export const copyMenuItem = t => ({
  label: t('Copy'),
  id: 'copyMenuItem',
  role: 'copy'
})

export const pasteMenuItem = t => ({
  label: t('Paste'),
  id: 'pasteMenuItem',
  role: 'paste'
})

export const copyAsMarkdownMenuItem = t => ({
  label: t('Copy As Markdown'),
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-markdown')
  }
})

export const copyAsHtmlMenuItem = t => ({
  label: t('Copy As Html'),
  id: 'copyAsHtmlMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-html')
  }
})

export const pasteAsPlainTextMenuItem = t => ({
  label: t('Paste as Plain Text'),
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-paste-as-plain-text')
  }
})

export const insertBeforeMenuItem = t => ({
  label: t('Insert Paragraph Before'),
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'before')
  }
})

export const insertAfterMenuItem = t => ({
  label: t('Insert Paragraph After'),
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'after')
  }
})

export const SEPARATOR = {
  type: 'separator'
}
