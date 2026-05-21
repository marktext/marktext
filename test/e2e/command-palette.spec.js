const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, sendIpcToRenderer } = require('./helpers')

test.describe('Command palette', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Palette\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('IPC opens the palette', async() => {
    await sendIpcToRenderer(app, 'mt::show-command-palette')
    // The el-dialog renders a search input. It may be teleported outside
    // the .command-palette wrapper; locate by the search-wrapper or input.search.
    const searchInput = page.locator('.search-wrapper input.search, input.search').first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })
  })

  test('Escape closes the palette', async() => {
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => {
        const inputs = document.querySelectorAll('input.search')
        for (const i of inputs) {
          const r = i.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) return false
        }
        return true
      },
      null,
      { timeout: 5000 }
    )
  })
})
