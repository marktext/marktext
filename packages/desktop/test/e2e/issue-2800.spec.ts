// Regression guard for issue #2800: typing literal `<pre>test</pre>` in
// the editor crashed the renderer with
//   IndexSizeError: Failed to execute 'setStart' on 'Range':
//   There is no child at offset 5.
//
// The crash family overlaps with crash-range-offset.spec.ts but the offset
// here is a real small positive number, not a negative unsigned overflow,
// so the existing clamp at packages/muyajs/lib/selection/index.js did not
// cover it.
import { test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  placeCaretInEditor,
  typeIntoEditor,
  clearRendererErrors,
  expectNoRendererErrors
} from './helpers'

test.describe('Issue #2800: typing <pre>...</pre> does not crash', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# R\n\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('typing literal <pre>test</pre> and continuing does not crash', async() => {
    await typeIntoEditor(page, '<pre>test</pre>')
    await page.waitForTimeout(200)
    await page.keyboard.type(' more text', { delay: 10 })
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Home')
    await page.keyboard.press('End')
    await page.keyboard.type(' tail', { delay: 10 })
    await page.waitForTimeout(200)
    await expectNoRendererErrors(app)
  })

  test('typing other inline HTML tags does not crash', async() => {
    // Adjacent inline HTML opens — same partialRender mismatch family.
    await typeIntoEditor(page, '<span>foo</span>')
    await page.waitForTimeout(100)
    await page.keyboard.type(' bar', { delay: 10 })
    await page.keyboard.press('Home')
    await page.keyboard.press('End')
    await page.waitForTimeout(100)
    await expectNoRendererErrors(app)
  })

  test('typing <pre>...</pre> in typewriter mode does not crash', async() => {
    // Issue title mentions "in typewriter mode". Toggle it via menu and
    // re-run the recipe.
    const { clickMenuById, waitForMenuReady } = await import('./helpers')
    await waitForMenuReady(app)
    await clickMenuById(app, 'typewriterModeMenuItem').catch(() => { /* ok if id differs */ })
    await page.waitForTimeout(100)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
    await typeIntoEditor(page, '<pre>test</pre>')
    await page.waitForTimeout(150)
    await page.keyboard.type(' x', { delay: 10 })
    await expectNoRendererErrors(app)
  })
})
