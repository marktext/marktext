/** Minimal CodeMirror surface `scrollSourceEditorToLine` needs. */
interface ISourceEditor {
  setCursor: (
    pos: { line: number, ch: number },
    ch?: number | null,
    options?: { scroll?: boolean }
  ) => void
  heightAtLine: (line: number, mode: 'local' | 'page' | 'div') => number
  getScrollerElement?: () => HTMLElement | null | undefined
  scrollTo: (x: number | null, y: number | null) => void
}

/**
 * Scroll the Source Code (CodeMirror) editor so `line` sits at the TOP of the
 * viewport, animated. CodeMirror's own `scrollIntoView` only scrolls the
 * minimum amount, leaving the heading at the bottom edge with no animation, so
 * instead position the scroller directly: place the line's local Y at the top
 * via the scroller's native smooth scroll. `setCursor` is given `scroll: false`
 * so its built-in caret-into-view scroll doesn't fight the animation.
 */
export function scrollSourceEditorToLine(editor: ISourceEditor, line: number): void {
  editor.setCursor({ line, ch: 0 }, null, { scroll: false })

  const top = editor.heightAtLine(line, 'local')
  const scroller = editor.getScrollerElement?.()
  if (scroller && typeof scroller.scrollTo === 'function') {
    scroller.scrollTo({ top, behavior: 'smooth' })
  } else {
    editor.scrollTo(null, top)
  }
}

/**
 * Find the 0-based line number of the `headingIndex`-th markdown heading
 * (ATX `# foo` or setext `foo\n===`) in document order, skipping fenced code
 * blocks. Returns -1 when not found.
 *
 * Used by Source Code mode to resolve a TOC entry (whose order matches the
 * document heading order muya builds the TOC from) to a CodeMirror line.
 */
export function findMarkdownHeadingLine(markdown: string, headingIndex: number): number {
  if (headingIndex < 0) return -1

  const lines = markdown.split('\n')
  let fence: string | null = null
  let count = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Toggle fenced-code-block state on ``` / ~~~ markers.
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (marker === fence) fence = null
      continue
    }
    if (fence !== null) continue

    // ATX heading.
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
      if (count === headingIndex) return i
      count++
      continue
    }

    // Setext heading: a non-blank line immediately followed by an `===`/`---`
    // underline.
    const next = lines[i + 1]
    if (line.trim() !== '' && next !== undefined && /^ {0,3}(?:=+|-+)\s*$/.test(next)) {
      if (count === headingIndex) return i
      count++
      i++ // consume the underline line
    }
  }

  return -1
}
