const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, clickMenuById } = require('./helpers')

test.describe('Layout panel toggles', () => {
  let app = null
  let page = null

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
    await page.waitForFunction(
      (wasVisible) => {
        const el = document.querySelector('.side-bar')
        if (!el) return wasVisible
        const visible = el.style.display !== 'none' && el.offsetParent !== null
        return visible !== wasVisible
      },
      initial,
      { timeout: 5000 }
    )
    const afterToggle = await sideBar.isVisible()
    expect(afterToggle).not.toBe(initial)
    await clickMenuById(app, 'sideBarMenuItem')
  })

  test('Tab bar toggle flips .editor-tabs visibility', async() => {
    const tabBar = page.locator('.editor-tabs')
    const initial = await tabBar.isVisible()
    await clickMenuById(app, 'tabBarMenuItem')
    await page.waitForFunction(
      (wasVisible) => {
        const el = document.querySelector('.editor-tabs')
        if (!el) return !wasVisible
        const visible = el.style.display !== 'none' && el.offsetParent !== null
        return visible !== wasVisible
      },
      initial,
      { timeout: 5000 }
    )
    const afterToggle = await tabBar.isVisible()
    expect(afterToggle).not.toBe(initial)
    await clickMenuById(app, 'tabBarMenuItem')
  })

  test('TOC menu toggles ToC panel without throwing', async() => {
    // Ensure sidebar is visible so TOC has somewhere to render.
    const sideBar = page.locator('.side-bar')
    if (!(await sideBar.isVisible())) {
      await clickMenuById(app, 'sideBarMenuItem')
      await page.waitForFunction(() => {
        const el = document.querySelector('.side-bar')
        return el && el.offsetParent !== null
      }, null, { timeout: 5000 })
    }
    await clickMenuById(app, 'tocMenuItem')
    // No specific selector to assert (TOC mounts inside the sidebar);
    // verifying the menu invocation does not throw is the main signal.
    await page.waitForTimeout(200)
    await clickMenuById(app, 'tocMenuItem')
  })
})
