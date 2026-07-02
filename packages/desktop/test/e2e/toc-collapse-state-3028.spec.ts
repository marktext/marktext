import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// #3028 — collapsing a heading in the TOC must survive a document edit.
//
// The TOC el-tree was bound with `:default-expand-all` and reseeded from a
// fresh `listToTree(toc)` on every `json-change`, so any edit re-expanded the
// whole tree and discarded the user's collapse state.
//
//   # A
//     ## B
//       ### B1
//     ## C
const INITIAL_DOC = '# A\n\n## B\n\n### B1\n\n## C\n'

// Labels of TOC nodes that are actually visible (a collapsed parent hides its
// children via `display:none`, so they drop out of this list).
const readVisibleTocLabels = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('.side-bar-toc .el-tree .el-tree-node')
    ) as HTMLElement[]
    return nodes
      .filter((n) => n.offsetParent !== null)
      .map((n) => {
        const labelEl = n.querySelector(':scope > .el-tree-node__content .el-tree-node__label')
        return (labelEl?.textContent || '').trim()
      })
  })

const collapseNode = (page: Page, label: string): Promise<void> =>
  page.evaluate((lbl) => {
    const nodes = Array.from(
      document.querySelectorAll('.side-bar-toc .el-tree .el-tree-node')
    ) as HTMLElement[]
    const node = nodes.find((n) => {
      const l = n.querySelector(':scope > .el-tree-node__content .el-tree-node__label')
      return (l?.textContent || '').trim() === lbl
    })
    if (!node) throw new Error(`TOC node "${lbl}" not found`)
    const icon = node.querySelector(
      ':scope > .el-tree-node__content .el-tree-node__expand-icon'
    ) as HTMLElement | null
    if (!icon) throw new Error(`TOC node "${lbl}" has no expand icon`)
    icon.click()
  }, label)

const ensureSidebarVisible = async(app: ElectronApplication, page: Page): Promise<void> => {
  const visible = await page.evaluate(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return !!(el && el.offsetParent !== null)
  })
  if (!visible) {
    await clickMenuById(app, 'sideBarMenuItem')
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.side-bar') as HTMLElement | null
        return !!(el && el.offsetParent !== null)
      },
      null,
      { timeout: 5000 }
    )
  }
}

test.describe('TOC collapse state survives edits (#3028)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(INITIAL_DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await ensureSidebarVisible(app, page)
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 4,
      null,
      { timeout: 10000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('a collapsed heading stays collapsed after a content edit', async() => {
    // Everything expanded initially.
    await expect.poll(() => readVisibleTocLabels(page), { timeout: 8000 })
      .toEqual(['A', 'B', 'B1', 'C'])

    // Collapse "B": its child "B1" disappears.
    await collapseNode(page, 'B')
    await expect.poll(() => readVisibleTocLabels(page), { timeout: 5000 })
      .toEqual(['A', 'B', 'C'])

    // Edit a different heading ("C" -> "C2"), triggering UPDATE_TOC.
    const cContent = page
      .locator('.mu-container h2 .mu-atxheading-content')
      .filter({ hasText: 'C' })
      .last()
    await cContent.click()
    await page.keyboard.press('End')
    await page.keyboard.type('2', { delay: 20 })

    // After the live TOC update, "B" must still be collapsed (B1 hidden).
    await expect.poll(() => readVisibleTocLabels(page), { timeout: 8000 })
      .toEqual(['A', 'B', 'C2'])
  })
})
