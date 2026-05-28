import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById } from './helpers'

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

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Layout\n\n## Section A\n\n## Section B\n')
    app = launched.app
    page = launched.page
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
    // Ensure sidebar is visible so TOC has somewhere to render.
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
    // No specific selector to assert (TOC mounts inside the sidebar);
    // verifying the menu invocation does not throw is the main signal.
    await page.waitForTimeout(200)
    await clickMenuById(app, 'tocMenuItem')
  })

  // Regression for the gap left between the sidebar and editor when the
  // sidebar collapses to its 45px icon strip (rightColumn=''). The store's
  // `sideBarWidth` is clamped to ≥220, so the editor's max-width must come
  // from the *effective* sidebar width, not the raw store value.
  test('Editor fills width after collapsing sidebar to icon strip', async() => {
    // Ensure sidebar is visible.
    const sideBar = page.locator('.side-bar')
    if (!(await sideBar.isVisible())) {
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

    // Open search panel and then collapse it back to the icon strip by
    // clicking the search icon. We use a locator-based click (not a DOM
    // .click()) so Playwright handles focus/activation correctly.
    const searchIcon = page.locator('.side-bar .left-column > ul').first().locator('li').nth(1)

    // Step 1: ensure rightColumn='search' (sidebar width ≥ 220 with the
    // search panel mounted at `.side-bar-search`).
    for (let i = 0; i < 3; i++) {
      const { width, hasSearch } = await page.evaluate(() => {
        const sb = document.querySelector('.side-bar') as HTMLElement | null
        return {
          width: sb ? Math.round(sb.getBoundingClientRect().width) : 0,
          hasSearch: !!document.querySelector('.side-bar .right-column .side-bar-search')
        }
      })
      if (width >= 220 && hasSearch) break
      await searchIcon.click()
      await page.waitForTimeout(250)
    }

    // Step 2: click search icon again to collapse to icon strip. The sidebar
    // shrinks to its 45px icon column (+1px border-right = 46px outer width).
    await searchIcon.click()
    await page.waitForFunction(
      () => {
        const sb = document.querySelector('.side-bar') as HTMLElement | null
        return !!sb && sb.getBoundingClientRect().width <= 50
      },
      null,
      { timeout: 5000 }
    )

    const { editorWidth, sideBarWidth, viewportWidth } = await page.evaluate(() => {
      const editor = document.querySelector('.editor-with-tabs') as HTMLElement | null
      const sb = document.querySelector('.side-bar') as HTMLElement | null
      return {
        editorWidth: editor ? editor.getBoundingClientRect().width : 0,
        sideBarWidth: sb ? sb.getBoundingClientRect().width : 0,
        viewportWidth: window.innerWidth
      }
    })
    // Sidebar is the 45px icon strip (+1px border). The editor must consume
    // the remaining viewport width — before the fix it was capped by the
    // store's `sideBarWidth` (clamped to ≥220), leaving a 175+ px gap to the
    // right of the editor.
    expect(sideBarWidth).toBeLessThanOrEqual(50)
    expect(Math.abs(editorWidth - (viewportWidth - sideBarWidth))).toBeLessThanOrEqual(1)
  })
})
