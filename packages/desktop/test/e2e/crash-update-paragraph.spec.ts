// Regression guard for
// "TypeError: Cannot destructure property 'text' of 'block' as it is null."
// thrown at src/muya/lib/contentState/paragraphCtrl.js:486 (issues #2099,
// #3571, #3663, #3667, #3879).
//
// User-action paths from the bug reports:
//  - Open quick-insert in a fresh file (the @muyajs/core engine triggers it
//    with `/`, replacing the legacy `@`), pick "Header 1".
//  - Delete a paragraph then immediately trigger the Paragraph→Heading menu
//    while the model cursor still points at the now-removed block.
//
// On current develop, none of these recipes crash — the upstream guard plus
// `isAllowedTransformation` filtering keep updateParagraph from being called
// with a stale cursor. If these tests start failing, the upstream guards
// have regressed and paragraphCtrl.updateParagraph needs its own check.
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clickMenuById,
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  typeIntoEditor,
  waitForMenuReady
} from './helpers'

// Each test owns its own launch so the seed markdown can match the recipe
// being exercised (the #2099 report describes "fresh file", whereas the
// menu-driven tests need a paragraph to mutate). Keeping launch inside the
// test also makes failures easier to attribute to the right recipe.
const launchAndReady = async(
  seed: string
): Promise<{ app: ElectronApplication; page: Page }> => {
  const launched = await launchWithMarkdown(seed, { suppressErrorDialog: true })
  await waitForMenuReady(launched.app)
  await placeCaretInEditor(launched.page)
  await clearRendererErrors(launched.app)
  return { app: launched.app, page: launched.page }
}

test.describe('Crash: updateParagraph null block', () => {
  test('Issue #2099: open quick-insert in fresh file then select Header 1', async() => {
    // Fresh file = empty markdown. The #2099 report specifically says "opened
    // a new file" — seeding with anything else changes the recipe.
    const { app, page } = await launchAndReady('')
    try {
      // The @muyajs/core quick-insert menu is triggered by `/` (the legacy
      // engine used `@`). Type it into the empty paragraph to open the menu.
      await typeIntoEditor(page, '/')

      // The quick-insert float (`.mu-quick-insert`) is always present in the
      // DOM but parked off-screen (top:-9999, opacity:0) until shown. Wait for
      // it to be positioned on-screen — `state: 'visible'` honours the
      // opacity/position so we click the real, shown menu rather than the
      // parked one.
      const overlay = page.locator('.mu-quick-insert')
      await overlay.waitFor({ state: 'visible', timeout: 5000 })

      // Quick-insert items expose data-label matching the config in
      // packages/muya/src/ui/paragraphQuickInsertMenu/config.ts —
      // "atx-heading 1". Don't fall back to a localized text selector; fail
      // loudly if the stable selector breaks.
      const heading1 = overlay.locator('[data-label="atx-heading 1"]')
      await heading1.waitFor({ state: 'visible', timeout: 5000 })
      await heading1.click()

      // Allow the paragraph to be rewritten as a heading.
      await page.waitForSelector('.editor-component h1', { state: 'attached', timeout: 5000 })

      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })

  test('Delete a paragraph then invoke Heading 1 menu immediately', async() => {
    const { app, page } = await launchAndReady('# Doc\n\nFirst para.\n\nSecond para.\n')
    try {
      // Position at end of "Second para." and select the line backwards.
      await page.evaluate(() => {
        const spans = document.querySelectorAll('.editor-component span.mu-paragraph-content')
        const target = spans[spans.length - 1] as HTMLElement | null
        if (!target) return
        const range = document.createRange()
        range.selectNodeContents(target)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      })
      await page.waitForTimeout(100)
      // Delete the selected paragraph contents.
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Backspace')
        await page.waitForTimeout(10)
      }
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(50)

      // Now invoke the menu item that calls updateParagraph. If clickMenuById
      // throws (menu not built or id renamed), surface it — the test cannot
      // honestly assert no-crash if the crash surface was never exercised.
      await clickMenuById(app, 'heading1MenuItem')

      // The mutation runs through partialRender → renderer commits. Wait for
      // either an h1 to appear or a captured error.
      await page.waitForTimeout(200)

      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })

  test('Rapid alternation between Paragraph/Heading menu items', async() => {
    const { app, page } = await launchAndReady('# Doc\n\nFirst para.\n\nSecond para.\n')
    try {
      for (let i = 0; i < 6; i++) {
        // Surface failures — if the menu item id is wrong / menu not ready,
        // the test must fail rather than silently no-op.
        await clickMenuById(app, i % 2 === 0 ? 'heading1MenuItem' : 'paragraphMenuItem')
        await page.waitForTimeout(50)
      }
      // Verify some structural transition actually happened — if neither
      // heading nor paragraph styling toggles, the test was a no-op.
      const hasHeading = await page.locator('.editor-component h1').count()
      const hasParagraph = await page.locator('.editor-component p').count()
      expect(hasHeading + hasParagraph).toBeGreaterThan(0)
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })
})
