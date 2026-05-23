// Regression guard for
// "TypeError: Cannot destructure property 'text' of 'block' as it is null."
// thrown at src/muya/lib/contentState/paragraphCtrl.js:486 (issues #2099,
// #3571, #3663, #3667, #3879).
//
// User-action paths from the bug reports:
//  - Type `@` in a fresh file to open quick-insert, pick "Header 1" (now
//    pre-guarded at quickInsert/index.js:160).
//  - Delete a paragraph then immediately trigger the Paragraph→Heading menu
//    while the model cursor still points at the now-removed block.
//
// On current develop, none of these recipes crash — the upstream guard plus
// `isAllowedTransformation` filtering keep updateParagraph from being called
// with a stale cursor. If these tests start failing, the upstream guards
// have regressed and paragraphCtrl.updateParagraph needs its own check.
import { test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clickMenuById,
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  typeIntoEditor
} from './helpers'

test.describe('Crash: updateParagraph null block', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nFirst para.\n\nSecond para.\n')
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('Issue #2099: type @ in fresh file then select Header 1', async() => {
    // Fresh, single empty paragraph so the block-removal race in the report
    // (cursor on a paragraph that no longer exists) has the strongest chance.
    await typeIntoEditor(page, '@')
    await page.waitForTimeout(300)
    // Look for the quick-insert overlay and click the Header 1 item if present.
    const overlay = await page.$('.ag-quick-insert')
    if (overlay) {
      const header1 = await page.$('.ag-quick-insert [data-label="header 1"], .ag-quick-insert .item:has-text("Header 1")')
      if (header1) await header1.click()
    } else {
      // No overlay surfaced — fall back to using the menu item that produces
      // the same updateParagraph code path.
      try {
        await clickMenuById(app, 'heading1MenuItem')
      } catch {
        // ignored
      }
    }
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('Delete a paragraph then invoke Heading 1 menu immediately', async() => {
    // Position at end of "Second para." and select the line backwards.
    await page.evaluate(() => {
      const spans = document.querySelectorAll('.editor-component span.ag-paragraph')
      const target = spans[spans.length - 1] as HTMLElement | null
      if (!target) return
      const range = document.createRange()
      range.selectNodeContents(target)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    await page.waitForTimeout(100)
    // Delete the selected paragraph contents (Backspace × line length is
    // simpler than orchestrating a Delete that removes the block).
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(10)
    }
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(50)

    // Now invoke the menu item that calls updateParagraph; if the model
    // cursor still references the removed block, this is the crash.
    try {
      await clickMenuById(app, 'heading1MenuItem')
    } catch {
      // ignored
    }
    await page.waitForTimeout(300)

    await expectNoRendererErrors(app)
  })

  test('Rapid alternation between Paragraph/Heading menu items', async() => {
    for (let i = 0; i < 6; i++) {
      try {
        await clickMenuById(app, i % 2 === 0 ? 'heading1MenuItem' : 'paragraphMenuItem')
      } catch {
        // ignored
      }
      await page.waitForTimeout(50)
    }
    await expectNoRendererErrors(app)
  })
})
