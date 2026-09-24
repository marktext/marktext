import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Enough headings that the outline is taller than the sidebar.
const sections: string[] = []
for (let i = 1; i <= 30; i++) {
  sections.push(`## Section ${i}`, '', `Body text for section ${i}.`, '')
}
const DOC = ['# Long outline', '', 'Intro.', '', ...sections].join('\n')

const probe = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector('.side-bar-toc') as HTMLElement
    const title = document.querySelector('.side-bar-toc .title') as HTMLElement
    const tree = document.querySelector('.side-bar-toc .el-tree') as HTMLElement
    const panelBox = panel.getBoundingClientRect()
    const titleBox = title.getBoundingClientRect()
    return {
      treeScrollTop: tree.scrollTop,
      treeScrolls: tree.scrollHeight > tree.clientHeight,
      titleVisible: titleBox.bottom > panelBox.top && titleBox.top < panelBox.bottom
    }
  })

test.describe('TOC panel scrolling', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    const sidebarVisible = await page.evaluate(() => {
      const el = document.querySelector('.side-bar') as HTMLElement | null
      return !!(el && el.offsetParent !== null)
    })
    if (!sidebarVisible) await clickMenuById(app, 'sideBarMenuItem')
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 15000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 20,
      null,
      { timeout: 15000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the panel title stays put while the outline scrolls under it', async() => {
    const before = await probe(page)
    expect(before.treeScrolls, 'the outline must overflow for this to mean anything').toBe(true)
    expect(before.titleVisible).toBe(true)

    const box = await page.locator('.side-bar-toc').boundingBox()
    if (!box) throw new Error('the TOC panel has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200)

    await expect.poll(async() => (await probe(page)).treeScrollTop, { timeout: 5000 }).toBeGreaterThan(0)
    expect((await probe(page)).titleVisible).toBe(true)
  })
})
