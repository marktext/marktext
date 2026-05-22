import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  enterSourceMode,
  exitSourceMode,
  typeIntoEditor
} from './helpers'

test.describe('Editor input and source-mode roundtrip', () => {
  let app: ElectronApplication
  let page: Page

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
    const md = await page.evaluate(() => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror: { getValue(): string } })
        | null
      return cm ? cm.CodeMirror.getValue() : ''
    })
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
