import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, setSourceMarkdown, waitForMenuReady } from './helpers'

// PARITY SCOREBOARD — gap PG1 (file PG01), desktop e2e half.
//
// The engine-unit half lives in
// packages/muya/src/selection/__tests__/paritySelectionChange.spec.ts.
//
// Legacy muyajs `selectionChange` carried the ancestor block `affiliation`
// chain + block markdown types, which `createApplicationMenuState`
// (store/editor.ts) turned into Paragraph-menu check marks. #4410 restored the
// affiliation chain + per-endpoint block info on the `selection-change`
// payload, and the desktop adapter (`adaptSelectionChange`) now feeds them to
// the store, so the Paragraph-menu check marks light up again. Here we read the
// live application-menu `checked` state after placing the caret in a heading.

const headingMenuChecked = async(app: ElectronApplication, id: string): Promise<boolean> => {
  return await app.evaluate(({ Menu }, menuId) => {
    const menu = Menu.getApplicationMenu()
    if (!menu) return false
    const item = menu.getMenuItemById(menuId)
    return !!(item && item.checked)
  }, id)
}

// A heading renders `span.mu-atxheading-content`, not `mu-paragraph-content`,
// so the paragraph-only `placeCaretInEditor` helper would not place the caret
// here. Collapse the selection inside the heading's content span and nudge the
// engine to recompute its active block (same keyup trick the helper uses).
const placeCaretInHeading = async(page: Page): Promise<boolean> => {
  const ok = await page.evaluate(() => {
    const root = document.querySelector('.editor-component') as HTMLElement | null
    if (!root) return false
    const span = root.querySelector('h1 span.mu-content') as HTMLElement | null
    if (!span) return false
    root.focus()
    const range = document.createRange()
    range.selectNodeContents(span)
    range.collapse(false)
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    return true
  })
  await page.waitForTimeout(150)
  return ok
}

test.describe('Parity PG1 — Paragraph menu reflects the current block', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed\n')
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('PG1: placing the caret in an H1 checks heading1MenuItem in the Paragraph menu', async() => {
    await setSourceMarkdown(page, app, '# A heading\n')
    // Sanity: the heading rendered and the caret landed inside it (so a `false`
    // result below is the affiliation gap, not a missed caret placement).
    await expect(page.locator('.editor-component h1')).toBeVisible()
    const placed = await placeCaretInHeading(page)
    expect(placed).toBe(true)
    // Give the selection-change → menu-state IPC round-trip time to settle.
    await page.waitForTimeout(400)

    const checked = await headingMenuChecked(app, 'heading1MenuItem')
    // Desired: the Paragraph menu shows H1 as the active block type.
    expect(checked).toBe(true)
  })
})
