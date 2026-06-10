import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithDoc } from './helpers'

test.describe('Image rendering', () => {
  let app: ElectronApplication | null = null
  let page: Page

  test.beforeAll(async () => {
    const launched = await launchWithDoc('test/e2e/data/link-image.md')
    app = launched.app
    page = launched.page
    await page.waitForTimeout(800)
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('renders image element in editor', async () => {
    const img = page.locator('.editor-component img')
    await expect(img.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('TOC sidebar', () => {
  let app: ElectronApplication | null = null
  let page: Page

  test.beforeAll(async () => {
    const launched = await launchWithDoc('test/e2e/data/headings.md')
    app = launched.app
    page = launched.page
    await page.waitForTimeout(800)
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('TOC sidebar shows heading entries', async () => {
    // Click the TOC icon in the sidebar to open TOC view
    const tocIcon = page.locator('[title*="Table"], [title*="TOC"], .side-bar-toc').first()
    if (await tocIcon.isVisible()) {
      await tocIcon.click()
    }
    // Wait for el-tree nodes to appear
    const treeNodes = page.locator('.side-bar-toc .el-tree-node')
    await expect(treeNodes.first()).toBeVisible({ timeout: 10000 })
    // Should have at least 2 heading entries
    const count = await treeNodes.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
