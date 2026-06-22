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
// minimal `scrollIntoView` did) and animate the scroll. Because CodeMirror runs
// with viewportMargin: Infinity (full-height render), the OUTER `.source-code`
// container is the scrollable element — that is what gets scrolled.
type SourceEditor = Parameters<typeof scrollSourceEditorToLine>[0]

describe('scrollSourceEditorToLine', () => {
  const makeEditor = () => {
    const setCursor = vi.fn()
    const heightAtLine = vi.fn(() => 480)
    const editor: SourceEditor = { setCursor, heightAtLine }
    return { editor, setCursor, heightAtLine }
  }

  it('smooth-scrolls the container so the line sits at the top', () => {
    const { editor, setCursor, heightAtLine } = makeEditor()
    const containerScrollTo = vi.fn()
    const container = { scrollTo: containerScrollTo } as unknown as HTMLElement

    scrollSourceEditorToLine(editor, 12, container)

    // line top resolved as a local Y coordinate
    expect(heightAtLine).toHaveBeenCalledWith(12, 'local')
    // the OUTER container is scrolled so that Y sits at the top, animated
    expect(containerScrollTo).toHaveBeenCalledWith({ top: 480, behavior: 'smooth' })
    // caret moved without its native scroll fighting the animation
    expect(setCursor).toHaveBeenCalledWith({ line: 12, ch: 0 }, null, { scroll: false })
  })

  it('still places the caret but does not throw when no container is given', () => {
    const { editor, setCursor, heightAtLine } = makeEditor()
    scrollSourceEditorToLine(editor, 5, null)
    expect(setCursor).toHaveBeenCalledWith({ line: 5, ch: 0 }, null, { scroll: false })
    expect(heightAtLine).not.toHaveBeenCalled()
  })
})
