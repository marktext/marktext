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

// Item 252 — switching tabs restores each tab's OWN engine undo/redo history.
// The `json-change` handler stashes `editor.getHistory()` per tab id in
// `engineHistoryByTab`; the `file-changed` handler replays it via
// `editor.setHistory(...)` after the `setContent` swap, so an undo issued on a
// returned-to tab walks that tab's history — not the tab that was last active.
test.describe('Tab switch restores the per-tab undo history', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('alpha\n')
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Reuse the proven caret-injection helper (TreeWalker + synthetic keyup) so
  // the engine commits its active block at an EXPLICIT offset. Then verify the
  // live DOM caret landed there before typing, so a following type-run lands as
  // a new undo boundary at the intended position.
  const placeCaretAt = async(paragraph: number, offset: number): Promise<void> => {
    await expect.poll(() => placeCaretInParagraph(page, paragraph, offset)).toBe(true)
    await expect.poll(() => readCaret(page)).toEqual({ index: paragraph, offset })
  }

  // Read the markdown of the Nth (0-based) paragraph content span straight off
  // the live engine DOM. Avoids the source-mode round trip (which would itself
  // perturb history) and stays scoped to whichever tab is currently active.
  const paragraphText = (index: number): Promise<string> =>
    page.evaluate((i) => {
      const spans = Array.from(
        document.querySelectorAll('.editor-component span.mu-paragraph-content')
      )
      return spans[i]?.textContent ?? ''
    }, index)

  test('undo on a returned-to tab reverts THAT tab edit and leaves the other tab intact', async() => {
    // Build tab A's history: place caret at the end of "alpha" (offset 5) and
    // type a run.
    await placeCaretAt(0, 5)
    await page.keyboard.type(' AEDIT', { delay: 0 })
    await expect.poll(() => paragraphText(0)).toBe('alpha AEDIT')
    // Let the trailing async `json-change` stash A's full snapshot + history.
    await page.waitForTimeout(300)

    // Open tab B (auto-selected) with its own body, then build B's history.
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'beta\n')
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 2,
      tabSelector,
      { timeout: 5000 }
    )
    await expect.poll(() => paragraphText(0)).toBe('beta')

    // Caret at the end of "beta" (offset 4), then type B's run.
    await placeCaretAt(0, 4)
    await page.keyboard.type(' BEDIT', { delay: 0 })
    await expect.poll(() => paragraphText(0)).toBe('beta BEDIT')
    // The engine's `json-change` (which stashes the per-tab markdown + history)
    // is async and may trail the last keystroke — let it land before switching
    // away, or the stashed snapshot loses the final character.
    await page.waitForTimeout(300)

    // Switch back to tab A (index 0). Its engine history must be restored.
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect.poll(() => paragraphText(0)).toContain('alpha AEDIT')

    // A single undo walks tab A's OWN history: it drops ' AEDIT', not ' BEDIT'.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect.poll(() => paragraphText(0)).toBe('alpha')

    // Tab B is untouched by tab A's undo — its edit survives on switch back.
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 1)
    await expect.poll(() => paragraphText(0)).toContain('beta BEDIT')
  })
})

// Item 260 — switching tabs restores each tab's OWN scrollTop. The container
// scroll listener persists `scrollTop` per tab (`updateScrollPosition`), and
// the `file-changed` handler replays it through `scrollToCords` (which adds a
// temporary padding-bottom + ResizeObserver so the saved offset is not clamped
// before the long doc has fully laid out).
test.describe('Tab switch restores the per-tab scroll position', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    // A long document so `.editor-component` is comfortably scrollable.
    const longBody = Array.from({ length: 400 }, (_, i) => `para line ${i}`).join('\n\n') + '\n'
    const launched = await launchWithMarkdown(longBody)
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  const scrollTop = (): Promise<number> =>
    page.evaluate(() => {
      const el = document.querySelector('.editor-component') as HTMLElement | null
      return el ? el.scrollTop : -1
    })

  test('scrollTop is restored on a returned-to tab while the other tab stays at top', async() => {
    // Scroll tab A's container down and let the scroll listener persist it.
    await page.evaluate(() => {
      const el = document.querySelector('.editor-component') as HTMLElement | null
      if (el) el.scrollTop = 3000
      el?.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => scrollTop()).toBeGreaterThan(1000)
    const captured = await scrollTop()

    // Open tab B (auto-selected, short body) — it starts at the top.
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'short\n')
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 2,
      tabSelector,
      { timeout: 5000 }
    )
    await expect.poll(() => scrollTop()).toBe(0)

    // Switch back to tab A — its scrollTop must be (approximately) restored.
    // Tolerance is generous: real layout height drives `scrollToCords` clamping.
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect.poll(() => scrollTop(), { timeout: 5000 }).toBeGreaterThan(1000)
    const restored = await scrollTop()
    expect(Math.abs(restored - captured)).toBeLessThan(captured)
  })
})
