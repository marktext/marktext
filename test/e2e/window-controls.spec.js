const { expect, test } = require('@playwright/test')
const { launchWithMarkdown } = require('./helpers')

// Smoke-tests the mt::win::* IPC handlers added when @electron/remote was
// removed. We can't always observe an OS-level fullscreen transition under
// xvfb, so we assert the IPC channels do reach main and that the BrowserWindow
// state methods produce the expected values via the new isMaximized /
// isFullScreen handlers.

test.describe('Window control IPC', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# window ctrl\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('isMaximized / isFullScreen invokes reach main', async() => {
    const result = await page.evaluate(async() => ({
      isMaximized: await window.electron.windowControl.isMaximized(),
      isFullScreen: await window.electron.windowControl.isFullScreen()
    }))
    expect(typeof result.isMaximized).toBe('boolean')
    expect(typeof result.isFullScreen).toBe('boolean')
  })

  test('toggle-maximize via IPC matches BrowserWindow state', async() => {
    // Capture initial state from the main process, toggle once via IPC, then
    // verify main observed the change.
    const before = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())[0]
      return win.isMaximized()
    })
    await page.evaluate(() => window.electron.windowControl.toggleMaximize())
    // Window state transitions are async on some platforms — poll briefly.
    await app.evaluate(async({ BrowserWindow }, prev) => {
      const win = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())[0]
      const deadline = Date.now() + 2000
      while (Date.now() < deadline && win.isMaximized() === prev) {
        await new Promise((r) => setTimeout(r, 50))
      }
      return win.isMaximized()
    }, before)
    const after = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())[0]
      return win.isMaximized()
    })
    expect(after).not.toBe(before)
    // Restore to leave the world tidy for downstream specs in the same worker.
    await page.evaluate(() => window.electron.windowControl.toggleMaximize())
  })

  test('window control surface is fully exposed via contextBridge', async() => {
    const surface = await page.evaluate(() => {
      const wc = window.electron?.windowControl || {}
      return [
        'minimize', 'maximize', 'unmaximize', 'toggleMaximize', 'close',
        'setFullScreen', 'toggleFullScreen',
        'isMaximized', 'isFullScreen',
        'popupMenu', 'popupApplicationMenu'
      ].map((k) => [k, typeof wc[k]])
    })
    for (const [name, type] of surface) {
      expect(type, `windowControl.${name}`).toBe('function')
    }
  })
})
