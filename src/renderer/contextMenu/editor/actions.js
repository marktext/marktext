import bus from '../../bus'

export const copyAsMarkdown = (menuItem, browserWindow) => {
  bus.$emit('copyAsMarkdown', 'copyAsMarkdown')
}

export const copyAsHtml = (menuItem, browserWindow) => {
  bus.$emit('copyAsHtml', 'copyAsHtml')
}

export const pasteAsMarkdown = (menuItem, browserWindow) => {
  bus.$emit('pasteAsMarkdown', 'pasteAsMarkdown')
}

export const insertParagraph = location => {
  bus.$emit('insertParagraph', location)
}
