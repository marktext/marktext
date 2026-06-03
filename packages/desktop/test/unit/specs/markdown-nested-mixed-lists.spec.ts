import { describe, it, expect } from 'vitest'
import ContentState from 'muya/lib/contentState'
import EventCenter from 'muya/lib/eventHandler/event'
import ExportMarkdown from 'muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from 'muya/lib/config'

interface MuyaCtx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventCenter: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentState: any
}

const createMuyaContext = (): MuyaCtx => {
  const ctx = {} as MuyaCtx
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, { endOfLine: 'lf' })
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  return ctx
}

const roundTrip = (markdown: string): string => {
  const ctx = createMuyaContext()
  ctx.contentState.importMarkdown(markdown)
  const blocks = ctx.contentState.getBlocks()
  return new ExportMarkdown(blocks).generate()
}

// Regression test for marktext#4341 — a list whose type differs from its
// enclosing list item (ul inside ol, or ol inside ul) was being rewritten
// into a paragraph by the legacy muya lexer, losing the list structure.
describe('Muya parser — nested mixed lists (#4341)', () => {
  it('preserves a bullet list nested inside an ordered list item', () => {
    const markdown = `1. Eat a carrot.
2. Find an application:
   - New
   - Open
   - Save
`
    expect(roundTrip(markdown)).to.equal(markdown)
  })

  it('preserves an ordered list nested inside a bullet list item', () => {
    const markdown = `- Outer bullet
- Container item:
  1. First step
  2. Second step
  3. Third step
`
    expect(roundTrip(markdown)).to.equal(markdown)
  })

  it('produces a ul block inside the ol li block tree (not a paragraph)', () => {
    const ctx = createMuyaContext()
    ctx.contentState.importMarkdown(`1. Eat a carrot.
2. Find an application:
   - New
   - Open
   - Save
`)
    const blocks = ctx.contentState.getBlocks()
    const ol = blocks.find((b: { type: string }) => b.type === 'ol')
    expect(ol, 'expected a top-level ol block').toBeDefined()
    const secondLi = ol.children[1]
    expect(secondLi.type).toBe('li')
    const nestedUl = secondLi.children.find((c: { type: string }) => c.type === 'ul')
    expect(nestedUl, 'expected a ul nested inside the second ol li').toBeDefined()
    expect(nestedUl.children.length).toBe(3)
  })
})
