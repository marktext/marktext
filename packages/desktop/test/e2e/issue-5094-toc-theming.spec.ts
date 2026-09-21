import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// #5094 — the TOC panel stayed Element Plus' default #606266 on every theme.
// Element Plus renders each tree node label inside an <el-text>, which declares
// its own `color`; that beats the themed color the panel only *inherits* down
// from `.el-tree`. On dark themes the result was unreadable dark gray on dark.
//
// The sidebar file tree (a hand-rolled component, not el-tree) has always used
// --sideBarColor, which is what the report asks the TOC to match.

const DOC = '# A\n\n## B\n\n### B1\n\n## C\n'

interface Probe {
  labelColor: string
  themedColor: string
  iconColor: string
  themedIconColor: string
}

const readColors = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const label = document.querySelector('.side-bar-toc .el-tree-node__label') as HTMLElement
    // `.el-tree` carries the panel's themed color; the label is supposed to inherit it.
    const tree = document.querySelector('.side-bar-toc .el-tree') as HTMLElement
    const icon = document.querySelector('.side-bar-toc .el-tree-node__expand-icon') as HTMLElement
    // The file tree's own arrow, i.e. the reference the report points at.
    const probe = document.createElement('span')
    probe.style.color = 'var(--sideBarIconColor)'
    tree.appendChild(probe)
    const themedIconColor = getComputedStyle(probe).color
    probe.remove()
    return {
      labelColor: getComputedStyle(label).color,
      themedColor: getComputedStyle(tree).color,
      iconColor: getComputedStyle(icon).color,
      themedIconColor
    }
  })

test.describe('#5094 TOC follows the active theme', () => {
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
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 4,
      null,
      { timeout: 15000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('heading labels and expand arrows use the theme colors, not Element defaults', async() => {
    const seen: string[] = []

    for (const theme of ['material-dark', 'light']) {
      await clickMenuById(app, theme)
      await expect
        .poll(async() => (await readColors(page)).themedColor, { timeout: 5000 })
        .not.toBe(seen[seen.length - 1])

      const { labelColor, themedColor, iconColor, themedIconColor } = await readColors(page)
      expect(labelColor, `label color on ${theme}`).toBe(themedColor)
      expect(iconColor, `expand icon color on ${theme}`).toBe(themedIconColor)
      // Element Plus' --el-text-color-regular, the color the panel was stuck on.
      expect(labelColor, `label color on ${theme}`).not.toBe('rgb(96, 98, 102)')
      seen.push(themedColor)
    }

    // The whole point of the report: the color actually changes with the theme.
    expect(seen[0]).not.toBe(seen[1])
  })
})
