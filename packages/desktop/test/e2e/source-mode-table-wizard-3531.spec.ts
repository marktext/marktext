import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  focusEditor,
  enterSourceMode,
  exitSourceMode,
  sendIpcToRenderer
} from './helpers'

// #3531 — the paragraph edit commands (e.g. the "Insert Table" wizard) still
// fired in source-code mode, where they operate on the hidden WYSIWYG engine
// instead of the visible CodeMirror source. Like undo/redo/selectAll, these
// must be blocked while in source mode.

const TABLE_DIALOG = '.ag-insert-table-dialog'

test.describe('paragraph edit commands are suppressed in source mode (#3531)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nsome text\n', {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the Insert Table wizard does not open while in source-code mode', async() => {
    await enterSourceMode(page, app)

    // Fire the "insert table" paragraph action (menu / shortcut path).
    await sendIpcToRenderer(app, 'mt::editor-paragraph-action', { type: 'table' })
    await page.waitForTimeout(400)

    // The table wizard dialog must NOT appear in source mode.
    await expect(page.locator(TABLE_DIALOG)).toHaveCount(0)

    await exitSourceMode(page, app)

    // Sanity: in WYSIWYG mode the same action DOES open the wizard.
    await focusEditor(page)
    await sendIpcToRenderer(app, 'mt::editor-paragraph-action', { type: 'table' })
    await expect(page.locator(TABLE_DIALOG)).toBeVisible({ timeout: 5000 })
  })
})
