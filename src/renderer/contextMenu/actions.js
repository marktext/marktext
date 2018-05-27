import bus from '../bus'

export const copyAsMarkdown = (menuItem, browserWindow) => {
  bus.$emit('copyAsMarkdown', 'copyAsMarkdown')
}

export const copyAsHtml = (menuItem, browserWindow) => {
  bus.$emit('copyAsHtml', 'copyAsHtml')
}

export const pasteAsPlainText = (menuItem, browserWindow) => {
  bus.$emit('pasteAsPlainText', 'pasteAsPlainText')
}

export const insertParagraph = location => {
  bus.$emit('insertParagraph', location)
}

export const editTable = data => {
  bus.$emit('editTable', data)
}
