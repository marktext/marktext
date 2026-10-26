import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('Check Launch MarkText', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Empty MarkText', async() => {
    const title = process.platform === 'darwin' ? 'Untitled-1' : 'Untitled-1 - MarkText'
    await expect(page).toHaveTitle(title)
  })
})
