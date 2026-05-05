import { t } from '../../i18n'

export const CUT = () => ({
  label: t('contextMenu.editor.cut'),
  id: 'cutMenuItem',
  role: 'cut'
})

export const COPY = () => ({
  label: t('contextMenu.editor.copy'),
  id: 'copyMenuItem',
  role: 'copy'
})

export const PASTE = () => ({
  label: t('contextMenu.editor.paste'),
  id: 'pasteMenuItem',
  role: 'paste'
})

export const COPY_AS_MARKDOWN = () => ({
  label: t('contextMenu.editor.copyAsMarkdown'),
  id: 'copyAsMarkdownMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-markdown')
  }
})

export const COPY_AS_HTML = () => ({
  label: t('contextMenu.editor.copyAsHtml'),
  id: 'copyAsHtmlMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-copy-as-html')
  }
})

export const PASTE_AS_PLAIN_TEXT = () => ({
  label: t('contextMenu.editor.pasteAsPlainText'),
  id: 'pasteAsPlainTextMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-paste-as-plain-text')
  }
})

export const INSERT_BEFORE = () => ({
  label: t('contextMenu.editor.insertParagraphBefore'),
  id: 'insertParagraphBeforeMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'before')
  }
})

export const INSERT_AFTER = () => ({
  label: t('contextMenu.editor.insertParagraphAfter'),
  id: 'insertParagraphAfterMenuItem',
  click (menuItem, targetWindow) {
    targetWindow.webContents.send('mt::cm-insert-paragraph', 'after')
  }
})

export const SEPARATOR = {
  type: 'separator'
}
