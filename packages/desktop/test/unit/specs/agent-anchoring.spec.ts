import type { ITextBlockInfo } from '@muyajs/core'
import { markdownToTextBlocks } from '@muyajs/core'
import { ANCHOR_CONTEXT_CHARS } from '@shared/types/comments'
import { describe, expect, it } from 'vitest'
import {
  AnchorCaptureError,
  captureAnchor,
  locateBlocksInSource,
  resolveAnchor,
  selectionFromSource
} from '@/agent/anchoring'

const block = (index: number, type: string, text: string): ITextBlockInfo => ({ index, type, text })

describe('captureAnchor', () => {
  it('stores the quote, 32 characters of context, and the type index', () => {
    const text = `${'a'.repeat(40)}QUOTE${'b'.repeat(40)}`
    const blocks = [
      block(0, 'atxheading', 'Title'),
      block(1, 'paragraph', 'before'),
      block(2, 'paragraph', text)
    ]
    const start = 40
    const anchor = captureAnchor(blocks, { index: 2, start, end: start + 'QUOTE'.length })

    expect(anchor.quote).toBe('QUOTE')
    expect(anchor.prefix).toBe('a'.repeat(ANCHOR_CONTEXT_CHARS))
    expect(anchor.suffix).toBe('b'.repeat(ANCHOR_CONTEXT_CHARS))
    expect(anchor.blockHint).toEqual({ type: 'paragraph', index: 1 })
  })

  it('keeps a short prefix and suffix at the edges of the block', () => {
    const blocks = [block(0, 'listitem', 'Hello world')]
    const anchor = captureAnchor(blocks, { index: 0, start: 6, end: 11 })

    expect(anchor).toEqual({
      quote: 'world',
      prefix: 'Hello ',
      suffix: '',
      blockHint: { type: 'listitem', index: 0 }
    })
  })

  it('rejects an empty quote', () => {
    const blocks = [block(0, 'paragraph', 'Hello')]
    expect(() => captureAnchor(blocks, { index: 0, start: 2, end: 2 })).toThrow(AnchorCaptureError)
    expect(() => captureAnchor(blocks, { index: 3, start: 0, end: 1 })).toThrow(AnchorCaptureError)
  })
})

describe('resolveAnchor', () => {
  it('anchors a quote that occurs once', () => {
    const blocks = [block(0, 'paragraph', 'Hello brave world')]
    const anchor = captureAnchor(blocks, { index: 0, start: 6, end: 11 })

    expect(resolveAnchor(blocks, anchor)).toEqual({
      status: 'anchored',
      index: 0,
      start: 6,
      end: 11
    })
  })

  it('uses prefix and suffix when the quote is repeated', () => {
    const blocks = [block(0, 'paragraph', 'alpha TARGET beta TARGET')]
    const anchor = captureAnchor(blocks, { index: 0, start: 6, end: 12 })

    expect(resolveAnchor(blocks, anchor)).toEqual({
      status: 'anchored',
      index: 0,
      start: 6,
      end: 12
    })
  })

  it('uses the type hint when the local context is the same in two blocks', () => {
    const text = `${'p'.repeat(32)}QUOTE${'s'.repeat(32)}`
    const blocks = [
      block(0, 'paragraph', text),
      block(1, 'atxheading', 'between'),
      block(2, 'paragraph', text)
    ]
    const anchor = captureAnchor(blocks, { index: 2, start: 32, end: 37 })

    expect(anchor.blockHint).toEqual({ type: 'paragraph', index: 1 })
    expect(resolveAnchor(blocks, anchor)).toEqual({
      status: 'anchored',
      index: 2,
      start: 32,
      end: 37
    })
  })

  it('orphans a repeated quote whose context does not pick one hit', () => {
    const text = `${'p'.repeat(32)}QUOTE${'s'.repeat(32)}${'p'.repeat(32)}QUOTE${'s'.repeat(32)}`
    const blocks = [block(0, 'paragraph', text)]
    const anchor = captureAnchor(blocks, { index: 0, start: 32, end: 37 })

    expect(resolveAnchor(blocks, anchor).status).toBe('orphaned')
  })

  it('orphans a quote that the edit removed', () => {
    const blocks = [block(0, 'paragraph', 'Hello brave world')]
    const anchor = captureAnchor(blocks, { index: 0, start: 6, end: 11 })

    expect(resolveAnchor([block(0, 'paragraph', 'Hello world')], anchor)).toEqual({ status: 'orphaned' })
  })

  it('keeps a quote after text is inserted before it', () => {
    const blocks = [block(0, 'paragraph', 'Hello brave world')]
    const anchor = captureAnchor(blocks, { index: 0, start: 6, end: 11 })
    const edited = [block(0, 'paragraph', 'XXHello brave world')]

    expect(resolveAnchor(edited, anchor)).toEqual({
      status: 'anchored',
      index: 0,
      start: 8,
      end: 13
    })
  })

  it('orphans an empty quote without searching', () => {
    const anchor = {
      quote: '',
      prefix: '',
      suffix: '',
      blockHint: { type: 'paragraph', index: 0 }
    }

    expect(resolveAnchor([block(0, 'paragraph', '')], anchor)).toEqual({ status: 'orphaned' })
  })

  it('anchors a unique quote even when the hint block is gone', () => {
    const blocks = [
      block(0, 'paragraph', 'only here'),
      block(1, 'paragraph', 'other')
    ]
    const anchor = captureAnchor(blocks, { index: 0, start: 5, end: 9 })
    const moved = [block(4, 'codeblock', 'only here')]

    expect(resolveAnchor(moved, anchor)).toEqual({
      status: 'anchored',
      index: 4,
      start: 5,
      end: 9
    })
  })
})

const locatedBlock = (markdown: string, index: number) => {
  const blocks = markdownToTextBlocks(markdown)
  const located = locateBlocksInSource(markdown, blocks)
  const block = located.find((item) => item.index === index)
  if (!block) throw new Error(`block ${index} was not located`)
  return { blocks, located, block }
}

describe('locateBlocksInSource', () => {
  it('maps a paragraph offset onto the same source column', () => {
    const markdown = 'Alpha paragraph.\n'
    const { block } = locatedBlock(markdown, 0)

    expect(block.startLine).toBe(0)
    expect(block.endLine).toBe(0)
    expect(block.offsetToSource(6)).toEqual({ line: 0, ch: 6 })
  })

  it('maps a multiline paragraph inside a block quote', () => {
    const markdown = '> line one\n> line two\n'
    const { blocks, block } = locatedBlock(markdown, 0)

    expect(blocks[0]?.text).toBe('line one\nline two')
    expect(block.startLine).toBe(0)
    expect(block.endLine).toBe(1)
    expect(block.offsetToSource(0)).toEqual({ line: 0, ch: 2 })
    expect(block.offsetToSource('line one'.length + 1)).toEqual({ line: 1, ch: 2 })
  })

  it('maps a nested list item past its marker', () => {
    const markdown = '- outer\n  - inner item\n'
    const { block } = locatedBlock(markdown, 1)

    expect(block.offsetToSource(0)).toEqual({ line: 1, ch: 4 })
    expect(block.offsetToSource('inner'.length)).toEqual({ line: 1, ch: 4 + 'inner'.length })
  })

  it('maps a task item past the checkbox', () => {
    const markdown = '- [ ] task item\n'
    const { block } = locatedBlock(markdown, 0)

    expect(block.offsetToSource(0)).toEqual({ line: 0, ch: 6 })
  })

  it('maps a table cell on its source line', () => {
    const markdown = '| h1 | h2 |\n| --- | --- |\n| c1 | c2 |\n'
    const { blocks, block } = locatedBlock(markdown, 3)

    expect(blocks[3]?.text).toBe('c2')
    expect(block.startLine).toBe(2)
    expect(block.endLine).toBe(2)
    expect(block.offsetToSource(0)).toEqual({ line: 2, ch: 7 })
  })

  it('includes the setext underline in the line span', () => {
    const markdown = 'Setext heading\n===============\n'
    const { blocks, block } = locatedBlock(markdown, 0)

    expect(blocks[0]?.text).toBe('Setext heading')
    expect(block.startLine).toBe(0)
    expect(block.endLine).toBe(1)
    expect(block.offsetToSource(0)).toEqual({ line: 0, ch: 0 })
    expect(block.offsetToSource(blocks[0]?.text.length ?? 0)).toEqual({
      line: 0,
      ch: 'Setext heading'.length
    })
  })

  it('keeps the block line span when the text is not in the source', () => {
    const located = locateBlocksInSource('Alpha\n', [
      { index: 0, type: 'paragraph', text: 'missing' }
    ])

    expect(located[0]?.startLine).toBe(0)
    expect(located[0]?.endLine).toBe(0)
    expect(located[0]?.offsetToSource(0)).toBeNull()
  })

  it('round-trips a range from the block text through the source and back', () => {
    const markdown = '> quoted line with a brave word\n'
    const blocks = markdownToTextBlocks(markdown)
    const text = blocks[0]?.text ?? ''
    const start = text.indexOf('brave')
    const end = start + 'brave'.length
    const located = locateBlocksInSource(markdown, blocks)
    const from = located[0]?.offsetToSource(start)
    const to = located[0]?.offsetToSource(end)

    expect(start).toBeGreaterThanOrEqual(0)
    expect(from).toEqual({ line: 0, ch: 2 + start })
    expect(to).toEqual({ line: 0, ch: 2 + end })
    if (!from || !to) return
    expect(selectionFromSource(located, from, to)).toEqual({ index: 0, start, end })
  })

  it('refuses a selection on a list marker or across two blocks', () => {
    const markdown = '- outer item\n\nSecond\n'
    const blocks = markdownToTextBlocks(markdown)
    const located = locateBlocksInSource(markdown, blocks)

    expect(selectionFromSource(located, { line: 0, ch: 0 }, { line: 0, ch: 4 })).toBeNull()
    expect(selectionFromSource(located, { line: 0, ch: 2 }, { line: 2, ch: 3 })).toBeNull()
    expect(selectionFromSource(located, { line: 0, ch: 2 }, { line: 0, ch: 7 })).toEqual({
      index: 0,
      start: 0,
      end: 5
    })
  })
})
