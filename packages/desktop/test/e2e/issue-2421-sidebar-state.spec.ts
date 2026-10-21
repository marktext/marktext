import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// #2421 — switching sidebar views must preserve width and section collapse state.
const openSearch = (page: Page) => page.locator('.side-bar .search-button').click()
const returnToFiles = (page: Page) => page.locator('.side-bar .back-button').click()

const sideBarWidth = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return el ? Math.round(el.getBoundingClientRect().width) : 0
  })

test.describe('#2421 sidebar state survives view switches', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n\n## A\n\n## B\n')
    app = launched.app
    page = launched.page
    await page.waitForFunction(() => {
      const el = document.querySelector('.side-bar') as HTMLElement | null
      return !!(el && el.offsetParent !== null && el.getBoundingClientRect().width >= 220)
    }, null, { timeout: 5000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('search and back preserve a widened sidebar width', async() => {
    // Widen enough to expose accidental resets to the minimum width.
    const dragBar = page.locator('.side-bar .drag-bar')
    const box = await dragBar.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 80)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + 80, { steps: 8 })
    await page.mouse.up()
    await page.waitForFunction(() => {
      const el = document.querySelector('.side-bar') as HTMLElement | null
      return !!el && el.getBoundingClientRect().width >= 300
    }, null, { timeout: 5000 })

    const widened = await sideBarWidth(page)
    expect(widened).toBeGreaterThanOrEqual(300)

    await openSearch(page)
    await expect(page.locator('.side-bar-search')).toBeVisible()
    expect(await sideBarWidth(page)).toBe(widened)
    await returnToFiles(page)
    await expect(page.locator('.tree-view')).toBeVisible()

    const reExpanded = await sideBarWidth(page)
    expect(Math.abs(reExpanded - widened)).toBeLessThanOrEqual(3)
  })

  test('a collapsed tree section stays collapsed after toggling the sidebar', async() => {
    const arrow = page.locator('.side-bar .opened-files > .title .icon-arrow').first()
    await expect(arrow).toBeVisible()

    await arrow.click()
    await page.waitForFunction(() => {
      const a = document.querySelector('.side-bar .opened-files .icon-arrow')
      return !!(a && a.classList.contains('fold'))
    }, null, { timeout: 5000 })

    await openSearch(page)
    await returnToFiles(page)
    await page.waitForFunction(() => {
      const el = document.querySelector('.side-bar .opened-files') as HTMLElement | null
      return !!(el && el.offsetParent !== null)
    }, null, { timeout: 5000 })

    const stillCollapsed = await page.evaluate(() => {
      const a = document.querySelector('.side-bar .opened-files .icon-arrow')
      return !!(a && a.classList.contains('fold'))
    })
    expect(stillCollapsed).toBe(true)
  })
})
