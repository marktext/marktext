import fs from 'fs'
import path from 'path'

const loadMarkdownContent = pathname => {
  // Load file and ensure LF line endings.
  return fs.readFileSync(path.resolve('test/unit/data', pathname), 'utf-8').replace(/(?:\r\n|\n)/g, '\n')
}

export const BasicTextFormattingTemplate = () => {
  return loadMarkdownContent('common/BasicTextFormatting.md')
}

export const BlockquotesTemplate= () => {
  return loadMarkdownContent('common/Blockquotes.md')
}

export const CodeBlocksTemplate = () => {
  return loadMarkdownContent('common/CodeBlocks.md')
}

export const EscapesTemplate = () => {
  return loadMarkdownContent('common/Escapes.md')
}

export const HeadingsTemplate = () => {
  return loadMarkdownContent('common/Headings.md')
}

export const ImagesTemplate = () => {
  return loadMarkdownContent('common/Images.md')
}

export const LinksTemplate = () => {
  return loadMarkdownContent('common/Links.md')
}

export const ListsTemplate = () => {
  return loadMarkdownContent('common/Lists.md')
}

// --------------------------------------------------------
// GFM templates
//

export const GfmBasicTextFormattingTemplate = () => {
  return loadMarkdownContent('gfm/BasicTextFormatting.md')
}

export const GfmListsTemplate = () => {
  return loadMarkdownContent('gfm/Lists.md')
}

export const GfmTablesTemplate = () => {
  return loadMarkdownContent('gfm/Tables.md')
}
