import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, expectNoRendererErrors, clearRendererErrors } from './helpers'

const SVG_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmMDAiLz48L3N2Zz4='

const viewerVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.querySelector('.image-viewer') as HTMLElement | null
    if (!el) return false
    return getComputedStyle(el).display !== 'none'
  })

const zoomLabel = (page: Page): Promise<string> =>
  page.locator('.media-viewer-toolbar .zoom-level').innerText()

const contentTransform = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const img = document.querySelector('.image-viewer img') as HTMLElement | null
    return img?.style.transform ?? ''
  })

const openViewer = async(page: Page): Promise<void> => {
  const img = page.locator('.editor-component .mu-inline-image .mu-image-container img').first()
  await img.waitFor({ state: 'attached', timeout: 15000 })
  await img.click({ timeout: 5000 })
  await page.keyboard.press('Space')
  await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)
}

test.describe('media viewer controls', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
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

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    if (await viewerVisible(page)) {
      await page.keyboard.press('Escape')
      await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)
    }
    await page
      .locator('.editor-component .mu-paragraph-content')
      .first()
      .click({ position: { x: 2, y: 2 }, timeout: 5000 })
      .catch(() => {})
    await page.waitForTimeout(120)
    await clearRendererErrors(app)
  })

  test('the open viewer is a modal dialog that holds focus', async() => {
    await openViewer(page)

    const root = page.locator('.image-viewer')
    await expect(root).toHaveAttribute('role', 'dialog')
    await expect(root).toHaveAttribute('aria-modal', 'true')
    await expect(root).not.toHaveAttribute('aria-label', '')

    const focusInside = await page.evaluate(
      () => !!document.activeElement?.closest('.image-viewer')
    )
    expect(focusInside).toBe(true)

    await expectNoRendererErrors(app)
  })

  test('the toolbar offers zoom out, a zoom readout, zoom in and fit', async() => {
    await openViewer(page)

    await expect(page.locator('.media-viewer-toolbar button')).toHaveCount(4)
    expect(await zoomLabel(page)).toBe('100%')

    await expectNoRendererErrors(app)
  })

  test('the zoom buttons change the readout and the content transform', async() => {
    await openViewer(page)

    await page.locator('.media-viewer-toolbar button').nth(2).click()
    await expect.poll(() => zoomLabel(page), { timeout: 5000 }).not.toBe('100%')
    expect(await contentTransform(page)).toContain('scale(')

    await page.locator('.media-viewer-toolbar .zoom-level').click()
    await expect.poll(() => zoomLabel(page), { timeout: 5000 }).toBe('100%')

    await expectNoRendererErrors(app)
  })

  test('+ and - zoom, 1 returns to the actual size', async() => {
    await openViewer(page)

    await page.keyboard.press('+')
    await expect.poll(() => zoomLabel(page), { timeout: 5000 }).toBe('125%')

    await page.keyboard.press('-')
    await expect.poll(() => zoomLabel(page), { timeout: 5000 }).toBe('100%')

    await page.keyboard.press('+')
    await page.keyboard.press('+')
    await page.keyboard.press('1')
    await expect.poll(() => zoomLabel(page), { timeout: 5000 }).toBe('100%')

    await expectNoRendererErrors(app)
  })

  test('the arrow keys pan the content', async() => {
    await openViewer(page)
    expect(await contentTransform(page)).toBe('')

    await page.keyboard.press('ArrowRight')
    const moved = await contentTransform(page)
    expect(moved).toContain('translate(-40px, 0px)')

    await page.keyboard.press('ArrowDown')
    expect(await contentTransform(page)).toContain('translate(-40px, -40px)')

    await expectNoRendererErrors(app)
  })

  test('every control names itself with a localized tooltip', async() => {
    await openViewer(page)

    const controls = page.locator('.media-viewer-toolbar button')
    const count = await controls.count()
    expect(count).toBe(4)

    for (let i = 0; i < count; i++) {
      await controls.nth(i).hover()

      const tip = page.locator('.el-popper[role="tooltip"]:visible').first()
      await expect(tip).toBeVisible({ timeout: 5000 })

      const text = (await tip.innerText()).trim()
      expect(text.length).toBeGreaterThan(0)
      // A missing key renders as the key itself.
      expect(text).not.toContain('editor.mediaViewer')

      // The overlay sits at z-index 10002 and the popper is teleported out to
      // <body>, so "visible" is not enough — it has to paint above it.
      const onTop = await tip.evaluate((el) => {
        const { left, top, width, height } = el.getBoundingClientRect()
        const hit = document.elementFromPoint(left + width / 2, top + height / 2)
        return !!hit && (el === hit || el.contains(hit))
      })
      expect(onTop).toBe(true)

      await page.mouse.move(0, 0)
    }

    await expectNoRendererErrors(app)
  })

  test('moving along the toolbar leaves only one tooltip up', async() => {
    await openViewer(page)

    const controls = page.locator('.media-viewer-toolbar button')
    await controls.nth(0).hover()
    await expect(page.locator('.el-popper[role="tooltip"]:visible')).toHaveCount(1, {
      timeout: 5000
    })

    // The default hide delay used to leave the previous bubble up while the
    // next one opened.
    for (let i = 1; i < (await controls.count()); i++) {
      await controls.nth(i).hover()
      await expect(page.locator('.el-popper[role="tooltip"]:visible')).toHaveCount(1, {
        timeout: 5000
      })
    }

    await expectNoRendererErrors(app)
  })

  test('the close control has a tooltip too', async() => {
    await openViewer(page)
    await page.locator('.image-viewer .icon-close').hover()

    const tip = page.locator('.el-popper[role="tooltip"]:visible').first()
    await expect(tip).toBeVisible({ timeout: 5000 })
    expect((await tip.innerText()).trim().length).toBeGreaterThan(0)

    await expectNoRendererErrors(app)
  })

  test('the editor behind the viewer stops taking pointer events', async() => {
    await openViewer(page)

    const blocked = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.editor-component') as HTMLElement)
          .pointerEvents
    )
    expect(blocked).toBe('none')

    await page.keyboard.press('Escape')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

    const restored = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.editor-component') as HTMLElement)
          .pointerEvents
    )
    expect(restored).not.toBe('none')

    await expectNoRendererErrors(app)
  })
})
