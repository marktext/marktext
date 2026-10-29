import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// The fix for #4210 hid the whole in-app title bar under the native style, so
// the word counter it hosts disappeared with the duplicated filename. Only the
// filename may go: the OS title bar shows it, but nothing else shows the count.
test.describe('Native title bar keeps the word counter', () => {
  test.skip(process.platform === 'darwin', 'macOS windows are always frameless')

  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('Alpha beta gamma\n', {
      preferences: { titleBarStyle: 'native', language: 'en' }
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-container', { timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('shows the word counter without repeating the filename', async() => {
    await expect(page.locator('.title-bar .word-count')).toHaveText('Words 3')
    await expect(page.locator('.title-bar .title')).toHaveCount(0)
  })
})
