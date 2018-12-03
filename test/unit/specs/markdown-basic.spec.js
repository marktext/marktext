import ContentState from '../../../src/muya/lib/contentState'
import EventCenter from '../../../src/muya/lib/eventHandler/event'
import ExportMarkdown from '../../../src/muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from '../../../src/muya/lib/config'

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

const basicMarkdownTest = options => {
  const ctx = createMuyaContext(options)
  ctx.contentState.importMarkdown(getBasicMarkdown())

  const blocks = ctx.contentState.getBlocks()
  return new ExportMarkdown(blocks).generate()
}

describe('Muya parser', () => {
  it('Parse basic markdown (LF)', () => {
    const markdown = basicMarkdownTest({'endOfLine': 'lf'})

    // FIXME: We always add a new line at the end of the document. Add a option to disable the new line.
    expect(markdown).to.equal(getBasicMarkdown() + '\n')
  })
})

describe('Muya parser', () => {
  it('Parse basic markdown (CRLF)', () => {
    const markdown = basicMarkdownTest({'endOfLine': 'crlf'})

    // FIXME: We always add a new line at the end of the document. Add a option to disable the new line.
    // Muya always uses LF line endings
    expect(markdown).to.equal(getBasicMarkdown() + '\n')
  })
})

// ----------------------------------------------------------------------------
// Markdown templates
//

const getBasicMarkdown = () => {
  // TODO: Add test markdown file(s)
  return '# Heading 1'
}

// ----------------------------------------------------------------------------
// Markdown templates (failing)
//

// const getListInsideQuote = () => {
//   return `> - 1
// > - 1
// > - 1
//
// foo`
// }

// const getQuotesInsideListItem = () => {
//   return `* foo
//
//   > This is a blockquote
//   > inside a list item.
//
// * bar`
// }
