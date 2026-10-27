import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { clickMenuById, getElectronPath, launchWithMarkdown, openProjectFolder, sendIpcToRenderer, waitForEditor } from './helpers'

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
    const el = document.querySelector('.side-bar .project-trees')
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

const windowHeight = (app: ElectronApplication): Promise<number> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize()[1])

const addTabs = async(app: ElectronApplication, page: Page, total: number): Promise<void> => {
  for (let i = await rowCount(page); i < total; i++) {
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, `body ${i}\n`)
  }
  await expect.poll(() => rowCount(page), { timeout: 5000 }).toBeGreaterThanOrEqual(total)
  const titles = await page.locator('.tabs-container > li').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))
  expect(new Set(titles).size).toBe(titles.length)
}

const toggleOpenedFiles = (page: Page): Promise<void> =>
  page.locator('.side-bar .opened-files > .title .icon-arrow').first().click()

test.describe('#5685 sidebar opened files resize', () => {
  let app: ElectronApplication
  let page: Page
  let documentPath: string

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Doc\n')
    app = launched.app
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async() => ({ response: 1, checkboxChecked: false }) })
    page = launched.page
    documentPath = launched.filePath
    await openProjectFolder(app, page, path.dirname(launched.filePath), launched.filePath)
    await page.waitForSelector(rowSelector, { state: 'visible', timeout: 5000 })
  })

  test.afterEach(async() => {
    if (app) {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close()
    }
  })

  test('the resize handle only appears with more than four rows', async() => {
    await addTabs(app, page, 4)
    await expect(page.locator(resizeSelector)).toHaveCount(0)

    await addTabs(app, page, 7)
    await expect(page.locator(resizeSelector)).toHaveCount(1)
  })

  test('dragging the handle grows the list and survives a view switch', async() => {
    await addTabs(app, page, 7)
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

  test('arrow keys resize the focused handle', async() => {
    await addTabs(app, page, 7)
    const handle = page.locator(resizeSelector)
    await handle.focus()
    const before = await listHeight(page)

    await page.keyboard.press('ArrowDown')
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBe(before + 28)

    await page.keyboard.press('Home')
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBe(112)
  })

  test('the project tree keeps its room when the window shrinks', async() => {
    const originalHeight = await windowHeight(app)
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)

    await setWindowHeight(app, 420)
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBeLessThan(tall)
    expect(await projectTreeHeight(page)).toBeGreaterThanOrEqual(150)

    await setWindowHeight(app, originalHeight)
    await expect.poll(() => listHeight(page), { timeout: 3000 }).toBe(tall)
  })

  test('an explicit resize in a small window replaces the chosen height', async() => {
    const originalHeight = await windowHeight(app)
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)

    await setWindowHeight(app, 420)
    await expect.poll(() => listHeight(page)).toBeLessThan(tall)
    const small = await listHeight(page)
    await dragHandleBy(page, -28)
    await expect.poll(() => listHeight(page)).toBe(Math.max(112, small - 28))
    const chosen = await listHeight(page)

    await setWindowHeight(app, originalHeight)
    await expect.poll(() => listHeight(page)).toBe(chosen)
  })

  test('reopening the collapsed list leaves the project tree its room', async() => {
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)
    expect(tall).toBeGreaterThan(300)

    await toggleOpenedFiles(page)
    await expect(page.locator(resizeSelector)).toHaveCount(0)
    await setWindowHeight(app, 420)

    await toggleOpenedFiles(page)
    // The list renders back at its chosen height only if it fits; in the small
    // window it must shrink so the project tree keeps space instead of vanishing.
    await expect.poll(() => projectTreeHeight(page), { timeout: 3000 }).toBeGreaterThanOrEqual(150)
    expect(await listHeight(page)).toBeLessThan(tall)
  })

  test('reversing a drag at the content limit responds immediately', async() => {
    await addTabs(app, page, 7)
    const box = await page.locator(resizeSelector).boundingBox()
    if (!box) throw new Error('resize handle is not visible')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 300, { steps: 8 })
    await expect.poll(() => listHeight(page)).toBe(196)
    await page.mouse.move(x, y + 272)
    await expect.poll(() => listHeight(page)).toBe(168)
    await page.mouse.up()
    await dragHandleBy(page, -28)
    await expect.poll(() => listHeight(page)).toBe(140)
  })

  test('reversing a drag at the minimum responds immediately', async() => {
    await addTabs(app, page, 7)
    const box = await page.locator(resizeSelector).boundingBox()
    if (!box) throw new Error('resize handle is not visible')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y - 100, { steps: 8 })
    await expect.poll(() => listHeight(page)).toBe(112)
    await page.mouse.move(x, y - 72)
    await expect.poll(() => listHeight(page)).toBe(140)
    await page.mouse.up()
  })

  test('enabling opened files after a hidden resize recalculates the limit', async() => {
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)
    await sendIpcToRenderer(app, 'mt::user-preference', { openedFilesInSidebar: false })
    await expect(page.locator('.opened-files')).toHaveCount(0)
    await setWindowHeight(app, 420)
    await expect.poll(() => page.evaluate(() => innerHeight)).toBe(420)
    await sendIpcToRenderer(app, 'mt::user-preference', { openedFilesInSidebar: true })
    await expect(page.locator(resizeSelector)).toBeVisible()
    await expect.poll(() => projectTreeHeight(page)).toBeGreaterThanOrEqual(150)
    expect(await listHeight(page)).toBeLessThan(tall)
  })

  test('showing the sidebar after a hidden resize recalculates the limit', async() => {
    await addTabs(app, page, 16)
    await dragHandleBy(page, 1000)
    const tall = await listHeight(page)
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeHidden()
    await setWindowHeight(app, 420)
    await expect.poll(() => page.evaluate(() => innerHeight)).toBe(420)
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator(resizeSelector)).toBeVisible()
    await expect.poll(() => projectTreeHeight(page)).toBeGreaterThanOrEqual(150)
    expect(await listHeight(page)).toBeLessThan(tall)
  })

  test('a tiny window preserves the tree and restores the list afterwards', async() => {
    const originalHeight = await windowHeight(app)
    await addTabs(app, page, 7)
    await dragHandleBy(page, 56)
    const chosen = await listHeight(page)
    await setWindowHeight(app, 350)
    await expect.poll(() => listHeight(page)).toBeLessThan(112)
    expect(await projectTreeHeight(page)).toBeGreaterThanOrEqual(150)
    await setWindowHeight(app, originalHeight)
    await expect.poll(() => listHeight(page)).toBe(chosen)
  })

  test('End uses the content bound and ArrowUp shrinks by one row', async() => {
    await addTabs(app, page, 7)
    const handle = page.locator(resizeSelector)
    await handle.focus()
    await page.keyboard.press('End')
    await expect.poll(() => listHeight(page)).toBe(196)
    await expect(handle).toHaveAttribute('aria-valuemax', '196')
    await expect(handle).toHaveAttribute('aria-valuemin', '112')
    await expect(handle).toHaveAttribute('aria-valuenow', '196')
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => listHeight(page)).toBe(168)
    await page.keyboard.press('Shift+ArrowUp')
    await expect.poll(() => listHeight(page)).toBe(112)
  })

  test('an app restart restores the chosen height', async() => {
    await addTabs(app, page, 7)
    await dragHandleBy(page, 56)
    const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    await expect.poll(() => JSON.parse(readFileSync(path.join(userData, 'state', 'application-state.json'), 'utf8')).session.windows[0].layout.sidebar.openedFiles.preferredHeightPx).toBe(168)
    await app.close()
    const projectRoot = path.resolve(__dirname, '../..')
    app = await _electron.launch({
      executablePath: getElectronPath(),
      args: [projectRoot, '--user-data-dir', userData],
      cwd: projectRoot
    })
    page = await app.firstWindow()
    await waitForEditor(page)
    await expect.poll(() => rowCount(page)).toBe(7)
    await expect.poll(() => listHeight(page)).toBe(168)
  })

  test('closing tabs leaves no gap and reopening restores the preferred height', async() => {
    await addTabs(app, page, 7)
    await dragHandleBy(page, 84)
    await expect.poll(() => listHeight(page)).toBe(196)
    const ids = await page.locator('.tabs-container > li').evaluateAll(elements =>
      elements.slice(4).map(el => el.getAttribute('data-id'))
    )
    await sendIpcToRenderer(app, 'mt::force-close-tabs-by-id', ids)
    await expect.poll(() => rowCount(page)).toBe(4)
    await expect.poll(() => listHeight(page)).toBe(112)
    await expect(page.locator(resizeSelector)).toHaveCount(0)
    await addTabs(app, page, 7)
    await expect.poll(() => listHeight(page)).toBe(196)
  })

  test('pointer cancellation ends the drag', async() => {
    await addTabs(app, page, 7)
    const handle = page.locator(resizeSelector)
    const box = await handle.boundingBox()
    if (!box) throw new Error('resize handle is not visible')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 28)
    await expect.poll(() => listHeight(page)).toBe(140)
    await handle.evaluate(el => el.dispatchEvent(new PointerEvent('pointercancel', {
      pointerId: 1, bubbles: true
    })))
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 56)
    await page.mouse.up()
    expect(await listHeight(page)).toBe(140)
    expect(await page.evaluate(() => localStorage.getItem('side-bar-opened-files-height'))).toBeNull()
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    await expect.poll(() => JSON.parse(readFileSync(path.join(userData, 'state', 'application-state.json'), 'utf8')).session.windows[0].layout.sidebar.openedFiles.preferredHeightPx).toBe(140)
  })
})
