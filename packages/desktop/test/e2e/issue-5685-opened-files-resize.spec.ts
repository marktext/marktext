import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

// The sidebar "Opened files" list shows four rows by default; past that a handle
// under it lets the list be dragged taller, and the height is remembered. The
// project tree below always keeps some room, even after the window shrinks.

const rowSelector = '.side-bar .opened-files-list .opened-file'
const resizeSelector = '.side-bar .opened-files-resize'

const openSearch = (page: Page) => page.locator('.side-bar .search-button').click()
const returnToFiles = (page: Page) => page.locator('.side-bar .back-button').click()

const rowCount = (page: Page): Promise<number> => page.locator(rowSelector).count()

const listHeight = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const el = document.querySelector('.side-bar .opened-files-list')
    return el ? Math.round(el.getBoundingClientRect().height) : 0
  })

const projectTreeHeight = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const el = document.querySelector('.side-bar .project-tree')
    return el ? Math.round(el.getBoundingClientRect().height) : 0
  })

const dragHandleBy = async(page: Page, dy: number): Promise<void> => {
  const box = await page.locator(resizeSelector).boundingBox()
  if (!box) throw new Error('resize handle is not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 8 })
  await page.mouse.up()
}

const setWindowHeight = (app: ElectronApplication, height: number): Promise<void> =>
  app.evaluate(({ BrowserWindow }, h) => {
    for (const win of BrowserWindow.getAllWindows()) {
      const [width] = win.getContentSize()
      win.setContentSize(width, h)
    }
  }, height)

const addTabs = async(app: ElectronApplication, page: Page, total: number): Promise<void> => {
  for (let i = await rowCount(page); i < total; i++) {
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, `body ${i}\n`)
  }
  await expect.poll(() => rowCount(page), { timeout: 5000 }).toBeGreaterThanOrEqual(total)
}

test.describe('#5685 sidebar opened files resize', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n')
    app = launched.app
    page = launched.page
    await page.waitForSelector(rowSelector, { state: 'visible', timeout: 5000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the resize handle only appears with more than four rows', async() => {
    await addTabs(app, page, 4)
    await expect(page.locator(resizeSelector)).toHaveCount(0)

    await addTabs(app, page, 7)
    await expect(page.locator(resizeSelector)).toHaveCount(1)
  })

  test('dragging the handle grows the list and survives a view switch', async() => {
    const before = await listHeight(page)
    await dragHandleBy(page, 56)

    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBeGreaterThan(before)
    const resized = await listHeight(page)

    await openSearch(page)
    await expect(page.locator('.side-bar .opened-files')).toHaveCount(0)
    await returnToFiles(page)
    await page.waitForSelector(rowSelector, { state: 'visible', timeout: 5000 })

    expect(await listHeight(page)).toBe(resized)
  })

  test('the project tree keeps its room when the window shrinks', async() => {
    const [, originalHeight] = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getContentSize()
    )
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)

    await setWindowHeight(app, 420)
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBeLessThan(tall)
    expect(await projectTreeHeight(page)).toBeGreaterThan(100)

    await setWindowHeight(app, originalHeight)
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBe(tall)
  })
})
