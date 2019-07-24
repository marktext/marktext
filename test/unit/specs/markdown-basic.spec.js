import ContentState from '../../../src/muya/lib/contentState'
import EventCenter from '../../../src/muya/lib/eventHandler/event'
import ExportMarkdown from '../../../src/muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from '../../../src/muya/lib/config'
import * as templates from '../markdown'

const defaultOptions = { endOfLine: 'lf' }
const defaultOptionsCrlf = Object.assign({}, defaultOptions, { endOfLine: 'crlf' })

const createMuyaContext = options => {
  const ctx = {}
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  return ctx
}

// ----------------------------------------------------------------------------
// Muya parser (Markdown to HTML to Markdown)
//

const verifyMarkdown = (markdown, options) => {
  const ctx = createMuyaContext(options)
  ctx.contentState.importMarkdown(markdown)

  const blocks = ctx.contentState.getBlocks()
  const exportedMarkdown = new ExportMarkdown(blocks).generate()

  // FIXME: We always need to add a new line at the end of the document. Add a option to disable the new line.
  // Muya always use LF line endings.
  expect(exportedMarkdown).to.equal(markdown)
}

describe('Muya parser', () => {
  it('Basic Text Formatting', () => {
    verifyMarkdown(templates.BasicTextFormattingTemplate(), defaultOptions)
  })
  it('Blockquotes', () => {
    verifyMarkdown(templates.BlockquotesTemplate(), defaultOptions)
  })
  it('Code Blocks', () => {
    verifyMarkdown(templates.CodeBlocksTemplate(), defaultOptions)
  })
  it('Escapes', () => {
    verifyMarkdown(templates.EscapesTemplate(), defaultOptions)
  })
  it('Headings', () => {
    verifyMarkdown(templates.HeadingsTemplate(), defaultOptions)
  })
  it('Images', () => {
    verifyMarkdown(templates.ImagesTemplate(), defaultOptions)
  })
  it('Links', () => {
    verifyMarkdown(templates.LinksTemplate(), defaultOptions)
  })
  it('Lists', () => {
    verifyMarkdown(templates.ListsTemplate(), defaultOptions)
  })
  it('GFM - Basic Text Formatting', () => {
    verifyMarkdown(templates.GfmBasicTextFormattingTemplate(), defaultOptions)
  })
  it('GFM - Lists', () => {
    verifyMarkdown(templates.GfmListsTemplate(), defaultOptions)
  })
  it('GFM - Tables', () => {
    verifyMarkdown(templates.GfmTablesTemplate(), defaultOptions)
  })
})

describe('Muya parser (CRLF)', () => {
  it('Basic Text Formatting', () => {
    verifyMarkdown(templates.BasicTextFormattingTemplate(), defaultOptionsCrlf)
  })
  it('Blockquotes', () => {
    verifyMarkdown(templates.BlockquotesTemplate(), defaultOptionsCrlf)
  })
  it('Code Blocks', () => {
    verifyMarkdown(templates.CodeBlocksTemplate(), defaultOptionsCrlf)
  })
  it('Escapes', () => {
    verifyMarkdown(templates.EscapesTemplate(), defaultOptionsCrlf)
  })
  it('Headings', () => {
    verifyMarkdown(templates.HeadingsTemplate(), defaultOptionsCrlf)
  })
  it('Images', () => {
    verifyMarkdown(templates.ImagesTemplate(), defaultOptionsCrlf)
  })
  it('Links', () => {
    verifyMarkdown(templates.LinksTemplate(), defaultOptionsCrlf)
  })
  it('Lists', () => {
    verifyMarkdown(templates.ListsTemplate(), defaultOptionsCrlf)
  })
  it('GFM - Basic Text Formatting', () => {
    verifyMarkdown(templates.GfmBasicTextFormattingTemplate(), defaultOptionsCrlf)
  })
  it('GFM - Lists', () => {
    verifyMarkdown(templates.GfmListsTemplate(), defaultOptionsCrlf)
  })
  it('GFM - Tables', () => {
    verifyMarkdown(templates.GfmTablesTemplate(), defaultOptionsCrlf)
  })
})
