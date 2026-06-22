import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, focusEditor } from './helpers'

// Regression: selecting a word and opening the find bar (Cmd+F) must prefill
// the find input with the selection and run the search. The migration to
// @muyajs/core made the engine emit a collapsed `selection-change` when the
// find bar steals editor focus; the store used to clobber `searchMatches` on
// that empty selection, wiping the just-prefilled value and the match list.
test.describe('Find bar prefill from selection', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      '# Find test\n\nThe quick brown fox jumps over the lazy dog.\n'
    )
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('double-click word prefills the find input and counts matches', async() => {
    const point = await page.evaluate(() => {
      const paras = Array.from(document.querySelectorAll('.mu-paragraph'))
      for (const para of paras) {
        const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const t = walker.currentNode as Text
          if (t.textContent && t.textContent.includes('fox')) {
            const idx = t.textContent.indexOf('fox')
            const range = document.createRange()
            range.setStart(t, idx)
            range.setEnd(t, idx + 3)
            const rect = range.getBoundingClientRect()
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          }
        }
      }
      return null
    })
    if (!point) throw new Error('could not locate the word "fox" in the editor')

    await page.mouse.dblclick(point.x, point.y)
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('fox')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })

    const input = page.locator('.search-bar input').first()
    await expect(input).toHaveValue('fox')

    // The selection seeds a real search: the result counter reports the match.
    const result = page.locator('.search-bar .search-result')
    await expect(result).toContainText('1 /')
    await expect(result).not.toContainText('/ 0')
  })
})
