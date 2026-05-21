const { expect, test } = require('@playwright/test')
const { launchWithMarkdown } = require('./helpers')

// Verify the shell IPC shim (replaced @electron/remote): when the renderer
// asks to open an external URL it must reach the main-process handler instead
// of trying to navigate the window. We stub shell.openExternal in main so the
// browser doesn't actually launch.

test.describe('Shell IPC bridge', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# shell ext\n')
    app = launched.app
    page = launched.page
    // Intercept shell.openExternal in main and record what was requested.
    await app.evaluate(({ shell }) => {
      global.__lastExternalUrl = null
      const original = shell.openExternal
      shell.openExternal = (url) => {
        global.__lastExternalUrl = url
        return Promise.resolve()
      }
      global.__restoreShell = () => { shell.openExternal = original }
    })
  })

  test.afterAll(async() => {
    try { await app.evaluate(() => { if (global.__restoreShell) global.__restoreShell() }) } catch {}
    if (app) await app.close()
  })

  test('window.electron.shell.openExternal routes to main shell', async() => {
    const url = 'https://example.com/marktext-shell-test'
    await page.evaluate((u) => window.electron.shell.openExternal(u), url)
    // The handler is async; poll until main records the call.
    const captured = await app.evaluate(async() => {
      const deadline = Date.now() + 3000
      while (!global.__lastExternalUrl && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
      return global.__lastExternalUrl
    })
    expect(captured).toBe(url)
  })
})
