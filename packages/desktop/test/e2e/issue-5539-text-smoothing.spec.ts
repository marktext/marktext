import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// #5539 — the engine rewrite shipped `-webkit-font-smoothing: antialiased` on
// html/body, which the legacy engine had deliberately pinned to `auto`. Grayscale
// antialiasing drops the subpixel rendering Chromium uses on Windows/Linux and
// thins every stem, so the whole editor reads blurrier than 0.19.
test.describe('Issue #5539 editor text smoothing', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# smoothing\n\nThe quick brown fox.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('editor text keeps the platform default font smoothing', async() => {
    const smoothing = await page.evaluate(() => {
      const read = (el: Element | null): string =>
        el ? getComputedStyle(el).getPropertyValue('-webkit-font-smoothing') : ''
      return {
        html: read(document.documentElement),
        body: read(document.body),
        editor: read(document.querySelector('.editor-component'))
      }
    })

    expect(smoothing.html).toBe('auto')
    expect(smoothing.body).toBe('auto')
    expect(smoothing.editor).toBe('auto')
  })
})
