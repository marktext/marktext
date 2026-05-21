const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, clickMenuById } = require('./helpers')

test.describe('Theme switching', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Theme test\n\nHello theme world.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Switch to a dark theme adds body.dark', async() => {
    await clickMenuById(app, 'dracula')
    await expect(page.locator('body')).toHaveClass(/(^|\s)dark(\s|$)/)
  })

  test('Switch to a light theme removes body.dark', async() => {
    await clickMenuById(app, 'light')
    await page.waitForFunction(() => !document.body.classList.contains('dark'), null, { timeout: 5000 })
    expect(await page.evaluate(() => document.body.classList.contains('dark'))).toBe(false)
  })

  test('Switch back to dark theme re-applies body.dark', async() => {
    await clickMenuById(app, 'nord')
    await expect(page.locator('body')).toHaveClass(/(^|\s)dark(\s|$)/)
  })
})
