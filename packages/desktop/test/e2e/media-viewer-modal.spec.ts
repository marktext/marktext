import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  expectNoRendererErrors,
  sendIpcToRenderer,
  enterSourceMode
} from './helpers'

const SVG_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmMDAiLz48L3N2Zz4='

const editorPointerEvents = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      getComputedStyle(document.querySelector('.editor-component') as HTMLElement).pointerEvents
  )

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

    await expect.poll(() => editorPointerEvents(page), { timeout: 5000 }).not.toBe('none')

    await expectNoRendererErrors(app)
  })

  test('switching to source mode closes the viewer', async() => {
    await openViewer(page)

    await enterSourceMode(page, app)

    // Otherwise the overlay keeps showing a rendering of a document that is no
    // longer on screen, over an editor it is holding inert.
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

    await expectNoRendererErrors(app)
  })

  test('Tab cycles the viewer\'s own controls and never leaves it', async() => {
    await openViewer(page)

    const controls = await page.evaluate(
      () => document.querySelectorAll('.image-viewer .icon-close, .media-viewer-toolbar button').length
    )
    expect(controls).toBeGreaterThan(1)

    const seen = new Set<string>()
    // One turn past a full cycle: focus has to come back round, not walk out
    // into the editor the overlay is covering.
    for (let i = 0; i <= controls; i++) {
      await page.keyboard.press('Tab')
      const where = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null
        return {
          inside: !!active?.closest('.image-viewer'),
          label: active?.getAttribute('aria-label') ?? active?.tagName ?? ''
        }
      })
      expect(where.inside).toBe(true)
      seen.add(where.label)
    }
    expect(seen.size).toBe(controls)

    await expectNoRendererErrors(app)
  })

  test('Shift+Tab walks the controls backwards', async() => {
    await openViewer(page)

    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))

    await page.keyboard.press('Shift+Tab')
    const wrapped = await page.evaluate(() => ({
      inside: !!document.activeElement?.closest('.image-viewer'),
      label: document.activeElement?.getAttribute('aria-label')
    }))

    expect(wrapped.inside).toBe(true)
    expect(wrapped.label).not.toBe(first)

    await expectNoRendererErrors(app)
  })

  test('Enter activates the focused control instead of being swallowed', async() => {
    await openViewer(page)

    // Tab to the close control, which is the first thing in the overlay.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.className)).toContain('icon-close')

    await page.keyboard.press('Enter')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

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
