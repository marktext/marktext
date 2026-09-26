import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// #2245: with native window decorations each window draws its own menu bar on
// Linux and Windows, and `Menu.setApplicationMenu` writes into all of them at
// once. Swapping it on focus therefore stripped the menu bar off the editor
// window while Preferences was focused, and pushed the editor's menu bar onto
// Preferences as soon as the editor was focused again.

// Height of everything around the web contents. Gaining or losing a menu bar
// moves it either way: with `useContentSize` Electron keeps the content and
// resizes the window, otherwise the content shrinks under a fixed window.
const chromeHeight = (app: ElectronApplication, windowId: number): Promise<number> =>
  app.evaluate(({ BrowserWindow }, id) => {
    const win = BrowserWindow.fromId(id)!
    return win.getSize()[1] - win.getContentSize()[1]
  }, windowId)

const focusedWindowId = (app: ElectronApplication): Promise<number> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id ?? -1)

// The assertions below are about a menu bar that must *not* appear or
// disappear, so give the focus handler time to do the wrong thing.
const focusWindow = async(
  app: ElectronApplication,
  windowId: number,
  page: Page
): Promise<void> => {
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id)?.focus()
  }, windowId)
  await expect.poll(() => focusedWindowId(app), { timeout: 15000 }).toBe(windowId)
  await page.waitForTimeout(500)
}

test.describe('Editor and Preferences keep their own menu bar (#2245)', () => {
  test.skip(process.platform === 'darwin', 'macOS draws one menu bar for the whole application')

  let app: ElectronApplication
  let editor: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Menu bars\n', {
      preferences: { titleBarStyle: 'native' }
    })
    app = launched.app
    editor = launched.page
    await editor.waitForSelector('.mu-container', { timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('opening Preferences leaves the editor menu bar alone', async() => {
    const editorWindowId = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id
    )
    const editorChrome = await chromeHeight(app, editorWindowId)

    // Take the menu bar away and put it back, so the rest of the test knows a
    // menu bar is drawn here and that removing one is visible in these numbers.
    await app.evaluate(({ BrowserWindow }, id) => {
      BrowserWindow.fromId(id)!.removeMenu()
    }, editorWindowId)
    await expect
      .poll(() => chromeHeight(app, editorWindowId), { timeout: 10000 })
      .toBeLessThan(editorChrome)
    await app.evaluate(({ BrowserWindow, Menu }, id) => {
      BrowserWindow.fromId(id)!.setMenu(Menu.getApplicationMenu()!)
    }, editorWindowId)
    await expect
      .poll(() => chromeHeight(app, editorWindowId), { timeout: 10000 })
      .toBe(editorChrome)

    const settingsWindow = app.waitForEvent('window')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.emit('app-create-settings-window')
    })
    const settings = await settingsWindow
    await settings.waitForSelector('.pref-container', { timeout: 15000 })
    const settingsWindowId = await app.evaluate(({ BrowserWindow }, editorId) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.id !== editorId)
      return win!.id
    }, editorWindowId)
    await focusWindow(app, settingsWindowId, editor)

    expect(await chromeHeight(app, editorWindowId)).toBe(editorChrome)

    const settingsChrome = await chromeHeight(app, settingsWindowId)
    await focusWindow(app, editorWindowId, settings)

    expect(await chromeHeight(app, settingsWindowId)).toBe(settingsChrome)
    expect(await chromeHeight(app, editorWindowId)).toBe(editorChrome)
  })
})
