import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

const tabSelector = '.tabs-container > li'

test.describe('Tab management', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Tab base\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Initial document loads as a single tab in the tab list', async() => {
    // Tab bar may be hidden by default (v-show), but the DOM still contains the list.
    await page.waitForSelector('.tabs-container', { state: 'attached', timeout: 5000 })
    const count = await page.locator(tabSelector).count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Creating a new untitled tab grows the tab count', async() => {
    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => {
        return document.querySelectorAll(selector).length > prev
      },
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )
    const after = await page.locator(tabSelector).count()
    expect(after).toBeGreaterThan(before)
  })

  test('Creating a new untitled tab auto-focuses the editor', async() => {
    // Drop focus first so the assertion proves the NEW tab grabbed focus rather
    // than inheriting a stale one from the previously active editor.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )

    // A freshly created untitled tab auto-focuses the WYSIWYG editor: the
    // contenteditable (`.editor-component`) becomes `document.activeElement`,
    // AND a collapsed caret lands inside it — together that's the blinking
    // cursor the user expects without having to click into the editor first.
    const isFocusedWithCaret = () => {
      const root = document.querySelector('.editor-component')
      const active = document.activeElement
      const sel = window.getSelection()
      return (
        !!root &&
        !!active &&
        (root === active || root.contains(active)) &&
        !!sel &&
        sel.rangeCount > 0 &&
        sel.isCollapsed &&
        !!sel.anchorNode &&
        root.contains(sel.anchorNode)
      )
    }
    await page.waitForFunction(isFocusedWithCaret, null, { timeout: 5000 })
    expect(await page.evaluate(isFocusedWithCaret)).toBe(true)
  })
})
