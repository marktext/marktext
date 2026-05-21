const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, sendIpcToRenderer } = require('./helpers')

const tabSelector = '.tabs-container > li'

test.describe('Tab management', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Tab base\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Initial document loads as a single tab in the tab list', async() => {
    // Tab bar may be hidden by default (v-show), but the DOM still contains the list.
    await page.waitForSelector('.tabs-container', { state: 'attached', timeout: 5000 })
    const count = await page.locator(tabSelector).count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Creating a new untitled tab grows the tab count', async() => {
    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => {
        return document.querySelectorAll(selector).length > prev
      },
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )
    const after = await page.locator(tabSelector).count()
    expect(after).toBeGreaterThan(before)
  })
})
