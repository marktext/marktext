import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, waitForMenuReady } from './helpers'

const tabSelector = '.tabs-container > li'

// Place a collapsed caret at character offset `ch` inside the Nth (0-based)
// paragraph content span, then nudge the engine to commit its active block
// (the engine derives `activeContentBlock` from keyup/click on the editor
// root). Mirrors the deterministic injection used by parity-cursor-lang.spec.
const placeCaretInParagraph = (
  page: Page,
  index: number,
  ch: number
): Promise<boolean> =>
  page.evaluate(
    ({ paragraphIndex, offset }) => {
      const root = document.querySelector('.editor-component') as HTMLElement | null
      if (!root) return false
      root.focus()
      const spans = Array.from(root.querySelectorAll('span.mu-paragraph-content'))
      const target = spans[paragraphIndex] as HTMLElement | undefined
      if (!target) return false
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
      let remaining = offset
      let node = walker.nextNode()
      while (node) {
        const len = (node.textContent ?? '').length
        if (remaining <= len) break
        remaining -= len
        node = walker.nextNode()
      }
      if (!node) return false
      const range = document.createRange()
      range.setStart(node, Math.min(remaining, (node.textContent ?? '').length))
      range.collapse(true)
      const sel = window.getSelection()
      if (!sel) return false
      sel.removeAllRanges()
      sel.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      root.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
      )
      return true
    },
    { paragraphIndex: index, offset: ch }
  )

// Read the live DOM caret back as { paragraph index, offset within text node }.
const readCaret = (page: Page): Promise<{ index: number; offset: number } | null> =>
  page.evaluate(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return null
    const anchorEl =
      sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : (sel.anchorNode as Element)
    const content = anchorEl?.closest('span.mu-paragraph-content') as Element | null
    if (!content) return null
    const spans = Array.from(
      document.querySelectorAll('.editor-component span.mu-paragraph-content')
    )
    return { index: spans.indexOf(content), offset: sel.anchorOffset }
  })

test.describe('Tab switch restores the per-tab caret', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      'alpha first\n\nbeta second\n\ngamma third line\n'
    )
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('caret returns to its original block after switching away and back', async() => {
    // Caret after "gamma " (offset 6) in the third paragraph of tab A.
    expect(await placeCaretInParagraph(page, 2, 6)).toBe(true)
    await page.waitForTimeout(200)
    // Sanity: the caret is where we put it before any tab switch.
    expect(await readCaret(page)).toEqual({ index: 2, offset: 6 })

    // Open a second, auto-selected tab — this switches away from tab A.
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'other tab body\n')
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 2,
      tabSelector,
      { timeout: 5000 }
    )
    await page.waitForTimeout(200)

    // Switch back to tab A (index 0).
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await page.waitForTimeout(300)

    // The caret must be restored to the third paragraph at offset 6.
    const caret = await readCaret(page)
    expect(caret).toEqual({ index: 2, offset: 6 })
  })
})
