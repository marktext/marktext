import { describe, it, expect } from 'vitest'
import ContentState from 'muya/lib/contentState'
import EventCenter from 'muya/lib/eventHandler/event'
import ExportMarkdown from 'muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from 'muya/lib/config'
import * as templates from '../markdown'

interface MuyaOptions {
  endOfLine?: string
  [key: string]: unknown
}

const defaultOptions: MuyaOptions = { endOfLine: 'lf' }
const defaultOptionsCrlf: MuyaOptions = Object.assign({}, defaultOptions, { endOfLine: 'crlf' })

interface MuyaCtx {
  options: MuyaOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventCenter: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentState: any
}

const createMuyaContext = (options: MuyaOptions): MuyaCtx => {
  const ctx = {} as MuyaCtx
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  return ctx
}

// ----------------------------------------------------------------------------
// Muya parser (Markdown to HTML to Markdown)
//

const verifyMarkdown = (markdown: string, options: MuyaOptions): void => {
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
