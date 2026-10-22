import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, exitSourceMode, launchWithMarkdown, sendIpcToRenderer } from './helpers'

// View -> Reload Images broadcasts `mt::invalidate-image-cache` to the window.
// `invalidateImageCache()` is a Muya method, so the source view — whose handle
// is a CodeMirror instance — must not try to answer the broadcast.
//
// The throw does not reach the app's own `mt::handle-renderer-error` channel
// (that one is fed by `window`'s `error` event, which an exception inside an
// IPC listener never fires), so this watches Playwright's `pageerror` instead
// of the `getRendererErrors` sink. `suppressErrorDialog` is still set so a
// regression surfaces as a failed assertion rather than a modal that hangs the
// run.
const DOC = '# Heading\n\nSome text.\n\n![pic](./pic.png)\n'

const FLAG = '__mtReloadImagesSeen'

// A second listener on the same channel, registered after the store's. Node's
// EventEmitter runs listeners in registration order and an exception in one
// aborts the rest, so this flag flipping proves the store's handler — and the
// `bus` fan-out it drives — ran to completion.
const armProbe = (page: Page) =>
  page.evaluate((flag) => {
    const w = window as unknown as Record<string, unknown>
    w[flag] = false
    if (w[`${flag}:armed`]) return
    w[`${flag}:armed`] = true
    window.electron.ipcRenderer.on('mt::invalidate-image-cache', () => {
      w[flag] = true
    })
  }, FLAG)

const probeFired = (page: Page) =>
  page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag] === true, FLAG)

test.describe('Reload Images', () => {
  let app: ElectronApplication
  let page: Page
  const pageErrors: string[] = []

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    page.on('pageerror', (error) => pageErrors.push(String(error)))
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  const reloadImages = async(): Promise<void> => {
    await armProbe(page)
    pageErrors.length = 0

    await sendIpcToRenderer(app, 'mt::invalidate-image-cache')
    // A throw leaves the flag unset, so let it time out and let the assertions
    // below report which of the two things went wrong.
    await page.waitForFunction(
      (flag) => (window as unknown as Record<string, unknown>)[flag] === true,
      FLAG,
      { timeout: 5000 }
    ).catch(() => {})
  }

  test('does not throw while the source view is open', async() => {
    await enterSourceMode(page, app)
    await reloadImages()

    expect(pageErrors).toEqual([])
    expect(await probeFired(page)).toBe(true)
  })

  test('does not throw back in the WYSIWYG editor', async() => {
    await exitSourceMode(page, app)
    await reloadImages()

    expect(pageErrors).toEqual([])
    expect(await probeFired(page)).toBe(true)
  })
})
