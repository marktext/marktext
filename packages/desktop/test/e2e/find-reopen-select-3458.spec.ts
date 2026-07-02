import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, focusEditor } from './helpers'

// #3458 — re-pressing Find (Cmd/Ctrl-F) while the bar is already open just
// re-focused the input without selecting it, so the caret landed after the
// existing term and the next keystroke appended ("accretion"). Re-opening
// should highlight the current term so it can be typed over.

const FIND_INPUT = '.search-bar .search input'

test.describe('Find bar reopen selects the existing term (#3458)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('apple banana apple cherry\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('re-opening Find highlights the existing query so it can be typed over', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    await expect(page.locator('.search-bar')).toBeVisible({ timeout: 5000 })
    await page.locator(FIND_INPUT).fill('apple')
    // Let the search settle (active match selected) before re-opening.
    await expect.poll(() => page.locator('.search-bar .search-result').innerText())
      .toContain('/ 2')

    // Re-trigger Find while the bar is already open with a term present.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')

    // The whole term must be selected (so a keystroke replaces it), not left
    // with a collapsed caret at the end.
    await expect
      .poll(() =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLInputElement | null
          if (!el) return null
          return { start: el.selectionStart, end: el.selectionEnd, len: el.value.length }
        }, FIND_INPUT)
      )
      .toEqual({ start: 0, end: 5, len: 5 })

    // Typing over the selection replaces the term rather than appending to it.
    await page.keyboard.type('cherry')
    await expect.poll(() => page.locator(FIND_INPUT).inputValue()).toBe('cherry')
  })
})
