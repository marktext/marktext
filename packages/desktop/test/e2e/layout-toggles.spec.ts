import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as path from 'node:path'
import { launchWithMarkdown, clickMenuById, openProjectFolder, sendIpcToRenderer } from './helpers'

// Wait until a `v-show`-toggled element's visibility differs from `wasVisible`.
// A missing element counts as "not visible", so the change-detection logic
// stays consistent whether v-show clears the inline style or unmounts the node.
const waitForVisibilityFlip = (page: Page, selector: string, wasVisible: boolean) =>
  page.waitForFunction(
    ({ sel, prior }) => {
      const el = document.querySelector(sel) as HTMLElement | null
      const visible = !!(el && el.style.display !== 'none' && el.offsetParent !== null)
      return visible !== prior
    },
    { sel: selector, prior: wasVisible },
    { timeout: 5000 }
  )

test.describe('Layout panel toggles', () => {
  let app: ElectronApplication
  let page: Page
  let filePath: string

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Layout\n\n## Section A\n\n## Section B\n')
    app = launched.app
    page = launched.page
    filePath = launched.filePath
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Sidebar toggle changes .side-bar visibility', async() => {
    const sideBar = page.locator('.side-bar')
    const initial = await sideBar.isVisible()
    await clickMenuById(app, 'sideBarMenuItem')
    await waitForVisibilityFlip(page, '.side-bar', initial)
    const afterToggle = await sideBar.isVisible()
    expect(afterToggle).not.toBe(initial)
    await clickMenuById(app, 'sideBarMenuItem')
  })

  test('Tab bar toggle flips .editor-tabs visibility', async() => {
    const tabBar = page.locator('.editor-tabs')
    const initial = await tabBar.isVisible()
    await clickMenuById(app, 'tabBarMenuItem')
    await waitForVisibilityFlip(page, '.editor-tabs', initial)
    const afterToggle = await tabBar.isVisible()
    expect(afterToggle).not.toBe(initial)
    await clickMenuById(app, 'tabBarMenuItem')
  })

  test('TOC menu toggles ToC panel without throwing', async() => {
    const sideBar = page.locator('.side-bar')
    if (!(await sideBar.isVisible())) {
      await clickMenuById(app, 'sideBarMenuItem')
      await page.waitForFunction(
        () => {
          const el = document.querySelector('.side-bar') as HTMLElement | null
          return el && el.offsetParent !== null
        },
        null,
        { timeout: 5000 }
      )
    }
    await clickMenuById(app, 'tocMenuItem')
    await expect(page.locator('.document-outline')).not.toHaveClass(/is-expanded/)
    await page.waitForTimeout(200)
    await clickMenuById(app, 'tocMenuItem')
  })

  test('Search returns to files with the back button and Escape', async() => {
    const sideBar = page.locator('.side-bar')
    if (!(await sideBar.isVisible())) await clickMenuById(app, 'sideBarMenuItem')
    const searchButton = sideBar.locator('.search-button')
    const input = sideBar.locator('.search-input')
    const width = await sideBar.evaluate(el => el.getBoundingClientRect().width)

    await expect(sideBar.locator('.left-column')).toHaveCount(0)
    const searchIconCenter = await searchButton.evaluate(el => {
      const box = el.getBoundingClientRect()
      return box.y + box.height / 2
    })
    await searchButton.click()
    await expect(input).toBeFocused()
    const searchBoxCenter = await sideBar.locator('.search-wrapper').evaluate(el => {
      const box = el.getBoundingClientRect()
      return box.y + box.height / 2
    })
    expect(Math.abs(searchBoxCenter - searchIconCenter)).toBeLessThanOrEqual(1)
    await expect(sideBar.locator('.controls button')).toHaveCount(3)
    await expect(sideBar.locator('.settings-button')).toBeVisible()
    expect(await sideBar.evaluate(el => el.getBoundingClientRect().width)).toBe(width)

    await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true })
    await expect(input).toBeVisible()
    await input.dispatchEvent('keydown', { key: 'Escape', keyCode: 229 })
    await expect(input).toBeVisible()
    await input.press('Escape')
    await expect(sideBar.locator('.tree-view')).toBeVisible()
    await expect(searchButton).not.toBeFocused()

    await searchButton.click()
    await sideBar.locator('.back-button').click()
    await expect(searchButton).toBeFocused()
    expect(await sideBar.evaluate(el => el.getBoundingClientRect().width)).toBe(width)
  })

  test('Existing folder search and result navigation still work at minimum width', async() => {
    await openProjectFolder(app, page, path.dirname(filePath), filePath)
    await sendIpcToRenderer(app, 'mt::set-view-layout', { sideBarWidth: 220 })
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findInFolder')
    const sideBar = page.locator('.side-bar')
    const input = sideBar.locator('.search-input')
    await expect(input).toBeFocused()
    await input.fill('Section')
    await input.press('Enter')
    await expect(sideBar.locator('.search-result-item')).toHaveCount(1)
    await expect(sideBar.locator('.search-result-item .matches li')).toHaveCount(2)
    await sideBar.locator('.search-result-item .matches li').first().click()
    await expect(input).toBeVisible()
    await expect(sideBar.locator('.settings-button')).toBeVisible()

    const inputBox = await input.evaluate(el => el.getBoundingClientRect().toJSON())
    const controlsBox = await sideBar.locator('.controls').evaluate(el => el.getBoundingClientRect().toJSON())
    expect(inputBox.width).toBeGreaterThan(50)
    expect(controlsBox.x).toBeGreaterThanOrEqual(inputBox.x + inputBox.width - 1)
    await sideBar.locator('.back-button').click()
  })

  test('Editor fills width after hiding the sidebar', async() => {
    const sideBar = page.locator('.side-bar')
    if (await sideBar.isVisible()) await clickMenuById(app, 'sideBarMenuItem')
    await expect(sideBar).toBeHidden()
    await expect.poll(async() => page.evaluate(() => {
      const editor = document.querySelector('.editor-with-tabs')
      if (!editor) throw new Error('Editor is not mounted')
      return Math.abs(editor.getBoundingClientRect().width - window.innerWidth)
    })).toBeLessThanOrEqual(1)
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(sideBar).toBeVisible()
  })
})
