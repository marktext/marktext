import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron, launchWithMarkdown, sendIpcToRenderer } from './helpers'

// #5353 — the opened-files list was capped at a hard 112px, so only four rows
// were reachable however tall the sidebar was. It now takes up to half the
// panel while a folder is open, and all of it when the directory section
// claims no height. These drive the real built app.

const WINDOW = { width: 1200, height: 800 }

const setWindowSize = (app: ElectronApplication, width: number, height: number) =>
  app.evaluate(
    ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size.width, size.height),
    { width, height }
  )

const openTabs = async(app: ElectronApplication, page: Page, count: number): Promise<void> => {
  const before = await page.locator('.opened-file').count()
  for (let i = before; i < count; i++) {
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, `Document ${i}\n`)
  }
  await expect(page.locator('.opened-file')).toHaveCount(count)
}

const heightOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().height)

const waitForWideSidebar = (page: Page) =>
  page.waitForFunction(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return !!(el && el.offsetParent !== null && el.getBoundingClientRect().width > 220)
  }, null, { timeout: 5000 })

test.describe('#5353 opened files use the available sidebar height', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n')
    app = launched.app
    page = launched.page
    await waitForWideSidebar(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Specs resize the window; put it back even when one of them fails, or the
  // next spec inherits a 400px-tall window from the shared app.
  test.afterEach(async() => {
    if (app) await setWindowSize(app, WINDOW.width, WINDOW.height)
  })

  test('eight open files fit without scrolling, and the project stays visible', async() => {
    await openTabs(app, page, 8)
    const list = page.locator('.opened-files-list')
    await expect.poll(() => list.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0)

    await setWindowSize(app, 1000, 400)
    await expect(page.locator('.project-tree > .title')).toBeInViewport()
    await expect(list).toBeInViewport()
  })

  test('collapsing the directory section hands its height to the list', async() => {
    await openTabs(app, page, 33)
    const before = {
      list: await heightOf(page, '.opened-files-list'),
      tree: await heightOf(page, '.project-tree')
    }
    // Enough files to overflow the half-panel cap, otherwise there is no
    // freed height to observe.
    await expect
      .poll(() =>
        page.locator('.opened-files-list').evaluate((el) => el.scrollHeight - el.clientHeight)
      )
      .toBeGreaterThan(0)

    await page.locator('.side-bar .project-tree > .title .icon-arrow').first().click()
    await expect(page.locator('.tree-view.directories-hidden')).toBeVisible()

    const after = {
      list: await heightOf(page, '.opened-files-list'),
      tree: await heightOf(page, '.project-tree')
    }
    // The collapsed section keeps its 30px header and nothing else.
    expect(after.tree).toBeLessThanOrEqual(40)
    expect(after.tree).toBeLessThan(before.tree)
    expect(after.list).toBeGreaterThan(before.list)

    await page.locator('.side-bar .project-tree > .title .icon-arrow').first().click()
    await expect(page.locator('.tree-view.directories-hidden')).toHaveCount(0)
  })
})

// A separate app: dropping the project empties the tab list, which the specs
// above rely on.
test.describe('#5353 with no folder open', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron([])
    app = launched.app
    page = launched.page
    // The e2e harness passes the package directory as the Electron entry, so
    // main opens it as a project. Replay an empty buffered state to get the
    // folder-less sidebar this issue is actually about.
    await sendIpcToRenderer(app, 'mt::load-state', {
      editor: { tabs: [], currentFileId: null },
      project: {},
      layout: { rightColumn: 'files', showSideBar: true, showTabBar: true }
    })
    await expect(page.locator('.tree-view .open-project')).toBeVisible()
    await waitForWideSidebar(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the list tracks its content instead of claiming the whole panel', async() => {
    await openTabs(app, page, 7)
    await expect(page.locator('.tree-view.files-only')).toBeVisible()

    const rowHeight = await heightOf(page, '.opened-file')
    const listHeight = await heightOf(page, '.opened-files-list')
    // A growing list would stretch to the full panel and strand the
    // "Open folder" button on its bottom edge with 455px of blank list above.
    expect(listHeight).toBeLessThanOrEqual(7 * rowHeight + 4)
    await expect(page.locator('.open-project .el-button')).toBeInViewport()
  })
})
