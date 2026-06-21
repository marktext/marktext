import { describe, expect, it, vi } from 'vitest'
import { findMarkdownHeadingLine, scrollSourceEditorToLine } from '@/util/sourceModeToc'

// marktext #3580: in Source Code mode, clicking a TOC entry must scroll the
// CodeMirror editor to the heading's line. This resolves a TOC index to a line.
describe('findMarkdownHeadingLine', () => {
  const doc = [
    '# First', // 0
    '', // 1
    'text', // 2
    '', // 3
    '## Second', // 4
    '', // 5
    'Setext', // 6
    '------', // 7  (setext h2 underline for line 6)
    '', // 8
    '### Third', // 9
  ].join('\n')

  it('finds the line of the N-th heading (ATX + setext, in order)', () => {
    expect(findMarkdownHeadingLine(doc, 0)).toBe(0) // # First
    expect(findMarkdownHeadingLine(doc, 1)).toBe(4) // ## Second
    expect(findMarkdownHeadingLine(doc, 2)).toBe(6) // Setext (setext heading)
    expect(findMarkdownHeadingLine(doc, 3)).toBe(9) // ### Third
  })

  it('returns -1 for an out-of-range index', () => {
    expect(findMarkdownHeadingLine(doc, 4)).toBe(-1)
    expect(findMarkdownHeadingLine(doc, -1)).toBe(-1)
  })

  it('ignores `#` and `---` inside fenced code blocks', () => {
    const fenced = [
      '# Real', // 0
      '', // 1
      '```', // 2
      '# not a heading', // 3
      'fake setext', // 4
      '---', // 5
      '```', // 6
      '', // 7
      '## AlsoReal', // 8
    ].join('\n')
    expect(findMarkdownHeadingLine(fenced, 0)).toBe(0)
    expect(findMarkdownHeadingLine(fenced, 1)).toBe(8)
  })
})

// marktext #3580 follow-up: clicking a TOC entry in Source Code mode must put
// the heading at the TOP of the viewport (not the bottom, as CodeMirror's
// minimal `scrollIntoView` did) and animate the scroll.
type SourceEditor = Parameters<typeof scrollSourceEditorToLine>[0]

describe('scrollSourceEditorToLine', () => {
  const makeEditor = (withScroller: boolean) => {
    const scrollerScrollTo = vi.fn()
    const scroller = withScroller
      ? ({ scrollTo: scrollerScrollTo } as unknown as HTMLElement)
      : null
    const setCursor = vi.fn()
    const heightAtLine = vi.fn(() => 480)
    const scrollTo = vi.fn()
    const editor: SourceEditor = {
      setCursor,
      heightAtLine,
      getScrollerElement: () => scroller,
      scrollTo
    }
    return { editor, scrollerScrollTo, setCursor, heightAtLine, scrollTo }
  }

  it('positions the line at the top via a smooth scroll of the scroller', () => {
    const { editor, scrollerScrollTo, setCursor, heightAtLine, scrollTo } = makeEditor(true)
    scrollSourceEditorToLine(editor, 12)

    // line top resolved as a local Y coordinate
    expect(heightAtLine).toHaveBeenCalledWith(12, 'local')
    // scroller scrolled so that Y sits at the top, animated
    expect(scrollerScrollTo).toHaveBeenCalledWith({ top: 480, behavior: 'smooth' })
    // caret moved without fighting the animation
    expect(setCursor).toHaveBeenCalledWith({ line: 12, ch: 0 }, null, { scroll: false })
    // the old minimal-scroll path is not used
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('falls back to cm.scrollTo when no scroller element is available', () => {
    const { editor, scrollTo } = makeEditor(false)
    scrollSourceEditorToLine(editor, 5)
    expect(scrollTo).toHaveBeenCalledWith(null, 480)
  })
})
