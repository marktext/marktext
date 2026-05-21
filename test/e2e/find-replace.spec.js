const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, sendIpcToRenderer, focusEditor } = require('./helpers')

test.describe('Find bar', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Find test\n\nThe quick brown fox jumps over the lazy dog. needleAlpha and needleBeta.\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Find action reveals .search-bar', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
  })

  test('Replace action shows the search bar in replace mode', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
  })

  test('Escape hides the search bar', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(searchBar).toBeHidden({ timeout: 5000 })
  })
})
