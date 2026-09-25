import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('media IPC bridge', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the save dialog, clipboard image and PlantUML fetch reach the renderer', async() => {
    expect(await page.evaluate(() => typeof window.electron?.dialog?.showSave)).toBe('function')
    expect(await page.evaluate(() => typeof window.electron?.clipboard?.writeImage)).toBe(
      'function'
    )
    expect(await page.evaluate(() => typeof window.diagram?.fetchPlantuml)).toBe('function')
  })

  test('main refuses a PlantUML request it did not compose', async() => {
    const refusals = await page.evaluate(async() => {
      const bad = [
        ['file:///etc', 'AAAA'],
        ['https://user:pass@evil.test', 'AAAA'],
        ['https://example.test', '../../etc/passwd']
      ] as const

      return Promise.all(
        bad.map(([server, encoded]) => window.diagram.fetchPlantuml(server, encoded, 'svg'))
      )
    })

    for (const result of refusals) {
      expect(result.ok).toBe(false)
    }
  })

  test('a PNG round-trips through the clipboard', async() => {
    // 1x1 transparent PNG.
    const written = await page.evaluate(async() => {
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return window.electron.clipboard.writeImage(bytes)
    })

    expect(written).toBe(true)
    expect(await app.evaluate(({ clipboard }) => !clipboard.readImage().isEmpty())).toBe(true)
  })
})
