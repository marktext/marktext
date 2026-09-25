import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  expectNoRendererErrors,
  sendIpcToRenderer
} from './helpers'

const SVG_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmMDAiLz48L3N2Zz4='

const viewerVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.querySelector('.image-viewer') as HTMLElement | null
    return !!el && getComputedStyle(el).display !== 'none'
  })

const openViewer = async(page: Page): Promise<void> => {
  const img = page.locator('.editor-component .mu-inline-image .mu-image-container img').first()
  await img.waitFor({ state: 'attached', timeout: 15000 })
  await img.click({ timeout: 5000 })
  await page.keyboard.press('Space')
  await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)
}

test.describe('media viewer is modal to the keyboard', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(`![alt](${SVG_DATA_URI})\n`, {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.editor-component .mu-inline-image.mu-image-success img', {
      state: 'attached',
      timeout: 15000
    })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  for (const key of ['Backspace', 'Delete', 'Enter']) {
    test(`${key} does not reach the document behind the viewer`, async() => {
      const before = await getMarkdownContent(page, app)
      expect(before).toContain('![alt](data:image/svg+xml')

      await openViewer(page)
      await page.keyboard.press(key)
      await page.waitForTimeout(300)

      // The overlay is still up, so the reader has no idea the editor is being
      // driven behind it.
      expect(await viewerVisible(page)).toBe(true)

      await page.keyboard.press('Escape')
      await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

      const after = await getMarkdownContent(page, app)
      expect(after).toContain('![alt](data:image/svg+xml')

      await expectNoRendererErrors(app)
    })
  }

  test('switching to another document closes the viewer', async() => {
    await openViewer(page)

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      () => document.querySelectorAll('.tabs-container > li').length > 1,
      undefined,
      { timeout: 5000 }
    )

    // Otherwise the overlay keeps showing the previous document's image while
    // holding the new one at `pointer-events: none`.
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

    const blocked = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.editor-component') as HTMLElement).pointerEvents
    )
    expect(blocked).not.toBe('none')

    await expectNoRendererErrors(app)
  })

  test('Space does not re-open the viewer over itself', async() => {
    await openViewer(page)

    const focusBefore = await page.evaluate(
      () => !!document.activeElement?.closest('.image-viewer')
    )
    expect(focusBefore).toBe(true)

    await page.keyboard.press('Space')
    await page.waitForTimeout(300)

    await page.keyboard.press('Escape')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

    // One Escape must be enough, and focus must land back in the document
    // rather than on the overlay that just went away.
    const focusAfter = await page.evaluate(() => document.activeElement?.tagName ?? null)
    expect(focusAfter).not.toBe('BODY')

    await expectNoRendererErrors(app)
  })
})
