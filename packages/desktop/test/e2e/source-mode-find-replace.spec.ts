import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, focusEditor, launchWithMarkdown, sendIpcToRenderer } from './helpers'

// #3311 — Find/Replace did nothing in source-code mode: the desktop find bar is
// `v-if="!sourceCode"`, so the `find`/`replace` bus events were dropped. Source
// mode must route them to CodeMirror's own search, surfacing a search dialog.
test.describe('Find/Replace in source-code mode (#3311)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Title\n\nThe quick brown fox jumps over the lazy dog.\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
    await enterSourceMode(page, app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Find action opens a CodeMirror search dialog with an input', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const input = page.locator('.source-code .CodeMirror-dialog input')
    await expect(input).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('Replace action opens a CodeMirror replace dialog with an input', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const input = page.locator('.source-code .CodeMirror-dialog input')
    await expect(input).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})
