const { expect, test } = require('@playwright/test')
const {
  launchWithMarkdown,
  getMarkdownContent,
  enterSourceMode,
  exitSourceMode,
  typeIntoEditor
} = require('./helpers')

test.describe('Editor input and source-mode roundtrip', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Hello\n\nStarting paragraph.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Initial markdown is loaded into the editor', async() => {
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('# Hello')
    expect(markdown).toContain('Starting paragraph.')
  })

  test('Toggling source mode preserves content', async() => {
    await enterSourceMode(page, app)
    const md = await page.evaluate(() => document.querySelector('.source-code .CodeMirror').CodeMirror.getValue())
    expect(md).toContain('# Hello')
    await exitSourceMode(page, app)
    const stillThere = await page.locator('.editor-component').isVisible()
    expect(stillThere).toBe(true)
  })

  test('Typing into the editor appends content', async() => {
    await typeIntoEditor(page, ' typed-token')
    await page.waitForTimeout(400)
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('typed-token')
  })
})
