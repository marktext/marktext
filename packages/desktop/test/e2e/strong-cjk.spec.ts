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

  test('CJK + **"x"** renders as bold in WYSIWYG', async() => {
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
