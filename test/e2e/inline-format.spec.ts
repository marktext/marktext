import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById } from './helpers'

// Note: applying inline format marks (bold/italic/etc.) requires a live Muya
// selection driven by user gestures. Setting DOM selection from outside the
// renderer is not enough to make Muya's contentState format() commit. So this
// spec verifies that the format menu items exist and clicking them does not
// crash the application — a smoke check for the menu wiring and IPC plumbing.
// Coverage of the actual mark transformation is deferred until Muya exposes a
// test-friendly selection hook.

const formatMenuIds = [
  'strongMenuItem',
  'emphasisMenuItem',
  'underlineMenuItem',
  'superscriptMenuItem',
  'subscriptMenuItem',
  'highlightMenuItem',
  'inlineCodeMenuItem',
  'inlineMathMenuItem',
  'strikeMenuItem'
]

test.describe('Inline format menu wiring', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('format wiring target\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  for (const id of formatMenuIds) {
    test(`Menu ${id} invokes without crash`, async() => {
      await clickMenuById(app, id)
      const crashed = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.isCrashed()
      )
      expect(crashed).toBe(false)
      const editorVisible = await page.locator('.editor-component').isVisible()
      expect(editorVisible).toBe(true)
    })
  }
})
