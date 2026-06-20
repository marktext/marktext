import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  waitForMenuReady,
  enterSourceMode,
  sendIpcToRenderer,
  focusEditor,
  typeIntoEditor,
  getMarkdownContent,
  expectNoRendererErrors
} from './helpers'

// Phase G — G7 / G8 parity.
//
// G7: the WYSIWYG -> source-code handoff must open CodeMirror at the same caret.
// The engine now exposes `getCursorOffset()` (the READ inverse of
// `setCursorByOffset`); editor.vue emits the resulting `{ line, ch }` cursor as
// `muyaIndexCursor` on every selection/content change, and sourceCode.vue
// positions the CodeMirror caret from it.
//
// G8: switching the UI language mid-session must refresh the already-rendered
// inline placeholder hints. `Muya.locale()` now re-renders the block tree, so an
// empty paragraph's quick-insert hint updates immediately.

// Place a collapsed caret at character offset `ch` inside the first text node
// of the Nth (0-based) non-empty paragraph content span, then nudge the engine
// to commit its active block (the engine derives `activeContentBlock` from
// keyup/click on the editor root). Using an explicit text-node offset keeps the
// caret position deterministic in headless Chromium.
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
      // The engine wraps content text in nested inline spans, so walk the
      // descendant text nodes and find the one holding character `offset`.
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

const getCmCursor = (page: Page): Promise<{ line: number; ch: number } | null> =>
  page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { getCursor(): { line: number; ch: number } } })
      | null
    return cm && cm.CodeMirror ? cm.CodeMirror.getCursor() : null
  })

test.describe('Parity G7 — WYSIWYG -> source caret sync', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      'first para\n\nsecond para\n\nthird para here\n'
    )
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('G7: source mode opens at the line/column the WYSIWYG caret was on', async() => {
    // Caret after "third " (offset 6) in the third paragraph.
    expect(await placeCaretInParagraph(page, 2, 6)).toBe(true)
    await page.waitForTimeout(200)

    await enterSourceMode(page, app)
    await page.waitForTimeout(300)

    const cursor = await getCmCursor(page)
    // Lines: 0 "first para", 1 blank, 2 "second para", 3 blank,
    // 4 "third para here".
    expect(cursor).toEqual({ line: 4, ch: 6 })
  })
})

test.describe('Parity G8 — language switch refreshes inline hints', () => {
  test('G8: an empty paragraph\'s quick-insert hint updates on language change', async() => {
    const { app, page } = await launchWithMarkdown('\n')
    await waitForMenuReady(app)

    const hintFor = (): Promise<string | null> =>
      page.evaluate(() => {
        const p = document.querySelector('.editor-component span.mu-paragraph-content')
        return p ? p.getAttribute('empty-hint') : null
      })

    const enHint = await hintFor()
    expect(enHint).toBeTruthy()

    // Mirror the real main-process order: AppMenu registers its
    // `broadcast-preferences-changed` listener before WindowManager, so
    // `language-changed` reaches the renderer BEFORE the `mt::user-preference`
    // that syncs the preferences store. The handler must therefore read the
    // locale from the event payload, not from the still-stale `language.value`.
    await sendIpcToRenderer(app, 'language-changed', 'zh-CN')
    await sendIpcToRenderer(app, 'mt::user-preference', { language: 'zh-CN' })
    await page.waitForTimeout(400)

    const zhHint = await hintFor()
    expect(zhHint).toBeTruthy()
    // The rendered hint changed language without re-typing/reloading.
    expect(zhHint).not.toBe(enHint)

    await app.close()
  })
})

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 270). Typing `#`/`##` to create an ATX
// heading converts the paragraph to an AtxHeading block, which appends a
// HeadingCopyLink attachment whose constructor calls
// `muya.i18n.t('Copy anchor link to this heading')`. Two converged migration
// bugs (#4424 / #4427) crashed that single i18n.t call under a NON-en locale.
// The engine layer pins the crash class comprehensively in
// packages/muya/src/__tests__/headingLocaleCrash.spec.ts (boots all 9 locales,
// types `# Heading`, asserts the translated copy-anchor aria-label, no throw).
//
// This desktop-e2e adds only the integration confirmation: through the REAL
// Electron renderer + Vue shell, switch the app locale to zh-CN (the same
// `language-changed` + `mt::user-preference` sequence the G8 test uses, which
// routes through editor.vue handleLanguageChanged -> muya.locale(zhCN) and
// re-renders the block tree), then drive the live "type `# x`" input path and
// confirm the heading renders with the right text and the renderer does NOT
// crash. Launch with suppressErrorDialog so the renderer-error counter is
// installed and expectNoRendererErrors is meaningful.
// ---------------------------------------------------------------------------

test.describe('Heading creation under zh-CN does not crash the renderer (item 270)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)

    // Switch the UI language to zh-CN before any heading is created so the
    // HeadingCopyLink attachment is built under the non-en locale that used to
    // crash. Mirror the real main-process order (language-changed precedes the
    // preferences sync), same as the G8 test above.
    await sendIpcToRenderer(app, 'language-changed', 'zh-CN')
    await sendIpcToRenderer(app, 'mt::user-preference', { language: 'zh-CN' })
    await page.waitForTimeout(400)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('typing `# Hello` renders an h1 with the right text under zh-CN', async() => {
    await focusEditor(page)
    // The leading `#` + space is the ATX-heading markdown shortcut; the engine
    // converts the empty paragraph to an atx-heading on input.
    await typeIntoEditor(page, '# Hello')

    const h1 = page.locator('.editor-component h1')
    await expect(h1).toHaveCount(1, { timeout: 5000 })
    await expect(h1.first()).toContainText('Hello')

    // The heading round-trips to `# Hello` in the markdown source — proof the
    // conversion actually produced an ATX heading (not just styled text).
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('# Hello')

    // The whole point of the guard: building HeadingCopyLink via muya.i18n.t
    // under zh-CN must not surface a renderer error.
    await expectNoRendererErrors(app)
  })

  test('typing `## H2` renders an h2 with the right text under zh-CN', async() => {
    // Continue in the same zh-CN session: caret at end of the h1, press Enter
    // to open a fresh empty paragraph, then type the level-2 ATX shortcut.
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)
    await typeIntoEditor(page, '## H2')

    const h2 = page.locator('.editor-component h2')
    await expect(h2).toHaveCount(1, { timeout: 5000 })
    await expect(h2.first()).toContainText('H2')

    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('## H2')

    // A second heading conversion under zh-CN (another HeadingCopyLink + i18n.t)
    // must also stay crash-free.
    await expectNoRendererErrors(app)
  })
})
