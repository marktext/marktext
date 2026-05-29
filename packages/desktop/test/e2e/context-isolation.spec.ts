import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

// Asserts the renderer is actually sandboxed: contextIsolation: true,
// nodeIntegration: false, sandbox: true. If any of these regress, the bridge
// is no longer load-bearing and the security boundary is gone — this single
// test is the canary.

test.describe('Renderer sandboxing', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('contextBridge active, nodeIntegration disabled, no preload leakage', async() => {
    // contextBridge produced window.electron with a working ipcRenderer
    expect(await page.evaluate(() => typeof window.electron?.ipcRenderer?.invoke)).toBe('function')

    // nodeIntegration: false — no require, no global, no Buffer
    expect(await page.evaluate(() => typeof require)).toBe('undefined')
    expect(await page.evaluate(() => typeof global)).toBe('undefined')
    expect(await page.evaluate(() => typeof Buffer)).toBe('undefined')

    // Preload-scope identifiers are not visible to the renderer
    const leaked = await page.evaluate(() =>
      ['fileUtilsAPI', 'electronAPI', 'pathAPI', 'commandAPI'].some((name) => name in window)
    )
    expect(leaked).toBe(false)
  })
})
