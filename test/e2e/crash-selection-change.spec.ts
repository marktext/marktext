// Regression guard for "selectionChange: expected cursor but cursor is null"
// (issues #4160, #3942 — thrown at src/muya/lib/contentState/paragraphCtrl.js:27).
//
// The throw is reachable when both the DOM selection has been cleared and
// `this.cursor` is null. We attempt the closest user-action recipe (lose DOM
// selection, then invoke a format menu item that calls selectionChange). On
// current develop these recipes pass — the model-cursor fallback at
// paragraphCtrl.js:18-22 catches the transient DOM-selection-loss case.
import { test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  expectNoRendererErrors,
  clearRendererErrors,
  clickMenuById,
  launchWithMarkdown,
  placeCaretInEditor,
  waitForMenuReady
} from './helpers'

test.describe('Crash: selectionChange null cursor', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nSome text with **bold**.\n', {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('Blur the editor, clear DOM selection, then invoke a format menu item', async() => {
    // Actually blur (not just clear selection) — the bug report path is the
    // user clicking outside the editor before invoking a shortcut.
    await page.evaluate(() => {
      const ae = document.activeElement as HTMLElement | null
      if (ae && typeof ae.blur === 'function') ae.blur()
      window.getSelection()?.removeAllRanges()
      document.dispatchEvent(new Event('selectionchange'))
    })
    await page.waitForTimeout(100)

    // Trigger the format menu item that internally calls selectionChange.
    // Surface failures from clickMenuById rather than swallowing them —
    // if the menu id is wrong, the assertion below would be vacuous.
    await clickMenuById(app, 'strongMenuItem')
    await page.waitForTimeout(150)

    await expectNoRendererErrors(app)
  })

  test('Repeated DOM selection clear + refocus does not throw', async() => {
    // Pure selection thrash — this verifies that the listeners hung off
    // `document.selectionchange` and the focus/blur lifecycle do not throw
    // when DOM selection is cycled out from underneath them. Menu invocation
    // is intentionally NOT part of this test (it's covered by the previous
    // case) so the spec name accurately describes the surface exercised.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges()
        ;(document.activeElement as HTMLElement | null)?.blur()
      })
      await page.waitForTimeout(50)
      await placeCaretInEditor(page)
      await page.waitForTimeout(50)
    }
    await expectNoRendererErrors(app)
  })
})
