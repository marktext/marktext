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

  // KNOWN GAP (engine #4307): the @muyajs/core markdown parser does not yet
  // recognise strong emphasis when the run is flanked by a CJK char on one side
  // and ASCII punctuation (here the opening quote) on the other, so the desktop
  // currently renders this as plain text. The engine tracks the same case as a
  // documented `it.fails` in
  // packages/muya/src/state/__tests__/strongCjkFlanking.spec.ts.
  //
  // The assertion below encodes the DESIRED behaviour (bold), and the test is
  // marked `test.fixme` so it is skipped until the engine fixes #4307 — at which
  // point removing `.fixme` makes it run and pass. We intentionally do NOT
  // assert the current plain-text rendering, so this spec doubles as a tripwire
  // that flips green the moment the gap is closed.
  test.fixme('CJK + **"x"** renders as bold in WYSIWYG (engine GAP #4307)', async() => {
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
