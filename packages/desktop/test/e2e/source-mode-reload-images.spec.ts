import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, exitSourceMode, launchWithMarkdown, sendIpcToRenderer, waitForEditor } from './helpers'

// View -> Reload Images broadcasts `mt::invalidate-image-cache` to the window.
// `invalidateImageCache()` is a Muya method, so the source view — whose handle
// is a CodeMirror instance — must not try to answer the broadcast.
//
// The throw lands as an uncaught renderer error rather than on the app's own
// `mt::handle-renderer-error` channel, so this watches Playwright's `pageerror`
// instead of the `getRendererErrors` sink.
const DOC = '# Heading\n\nSome text.\n\n![pic](./pic.png)\n'

// Long enough for a synchronous throw to travel back over CDP.
const ERROR_SETTLE_MS = 1500

test.describe('Reload Images', () => {
  let app: ElectronApplication
  let page: Page
  const pageErrors: string[] = []

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    await waitForEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('does not throw while the source view is open', async() => {
    await enterSourceMode(page, app)
    pageErrors.length = 0

    await sendIpcToRenderer(app, 'mt::invalidate-image-cache')
    await page.waitForTimeout(ERROR_SETTLE_MS)

    expect(pageErrors).toEqual([])
  })

  test('does not throw back in the WYSIWYG editor', async() => {
    await exitSourceMode(page, app)
    pageErrors.length = 0

    await sendIpcToRenderer(app, 'mt::invalidate-image-cache')
    await page.waitForTimeout(ERROR_SETTLE_MS)

    expect(pageErrors).toEqual([])
  })
})
