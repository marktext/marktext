import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, setSourceMarkdown } from './helpers'

test.describe('Strong emphasis with CJK boundaries (#4307)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed paragraph.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // ENGINE #4307 (now fixed): the @muyajs/core markdown parser recognises strong
  // emphasis when the run is flanked by a CJK char on one side and ASCII
  // punctuation (here the opening quote) on the other, so the desktop renders
  // this as bold. The engine asserts the same case (without any `it.fails`) in
  // packages/muya/src/state/__tests__/strongCjkFlanking.spec.ts (CJK_CASES).
  //
  // This desktop test was previously a `test.fixme` tripwire; it is now a live
  // end-to-end assertion that the WYSIWYG path renders the bold run.
  test('CJK + **"x"** renders as bold in WYSIWYG (engine #4307)', async() => {
    await setSourceMarkdown(page, app, '例子例子**"加粗"**例子例子\n')
    const strong = page.locator('.editor-component strong')
    await expect(strong).toHaveCount(1)
    await expect(strong.first()).toContainText('加粗')
  })

  test('CJK + **plain** still renders as bold (regression)', async() => {
    await setSourceMarkdown(page, app, '中文**加粗**中文\n')
    const strong = page.locator('.editor-component strong')
    await expect(strong).toHaveCount(1)
    await expect(strong.first()).toContainText('加粗')
  })
})
