import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  expectNoRendererErrors,
  clearRendererErrors
} from './helpers'

// Item 124 — Space on a selected image opens the desktop SimpleImageViewer;
// Esc closes it (desktop e2e).
//
// The engine half (the `preview-image` emit on Space, and `format-click` on a
// Cmd/Ctrl-click) is unit-covered in:
//   packages/muya/src/selection/__tests__/parityPreviewImage.spec.ts
//   packages/muya/src/__tests__/formatClickEvents.spec.ts
// The UNTESTED half is the desktop SimpleImageViewer wired up in
// editor.vue: the `.image-viewer` overlay container (template line 20), the
// SimpleImageViewer class (line 450), opened from the `preview-image`
// (line 1859) and `format-click` (line 1838) bus handlers, and closed by the
// document-level `keyup` Escape handler (line 966) / the close affordance.
//
// We drive the REAL built Electron app: render an SVG data-URI image, click it
// to select, press Space, assert `.image-viewer` becomes visible with an
// `<img>` mounted, press Escape, assert it is hidden and the viewer DOM is
// destroyed. We also assert Space did NOT insert a literal space into the
// markdown (the engine `preventDefault`s the Space keydown for a selected
// image), and exercise the Cmd/Ctrl-click path (item 130) that opens the same
// viewer.

// 1x1 red SVG, base64-encoded. `getImageSrc` (packages/muya/src/utils/image.ts)
// recognises this via DATA_URL_REG so the preview path resolves a real src.
const SVG_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmMDAiLz48L3N2Zz4='

// editor.vue computes the modifier as (isOsx && metaKey) || (!isOsx && ctrlKey),
// so mirror that for the Cmd/Ctrl-click test.
const modifierKey: 'Meta' | 'Control' = process.platform === 'darwin' ? 'Meta' : 'Control'

const viewerVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.querySelector('.image-viewer') as HTMLElement | null
    if (!el) return false
    // v-show toggles `display: none`; treat that as hidden.
    return el.offsetParent !== null || getComputedStyle(el).display !== 'none'
  })

const viewerImgCount = (page: Page): Promise<number> =>
  page.locator('.image-viewer img').count()

// Click the rendered inline image to populate the engine's selected-image
// state (ImageSelection._handleClick → selectImage). Returns the clicked
// element handle so the caller can keep driving it.
const selectImage = async(page: Page): Promise<void> => {
  const img = page.locator('.editor-component .mu-inline-image .mu-image-container img').first()
  await img.waitFor({ state: 'attached', timeout: 15000 })
  await img.click({ timeout: 5000 })
}

test.describe('SimpleImageViewer (Space-to-preview + Esc close)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(`![alt](${SVG_DATA_URI})\n`, {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    // The data-URI <img> mounts via the async loadImageAsync path; wait for the
    // success state so the image is selectable.
    await page.waitForSelector(
      '.editor-component .mu-inline-image.mu-image-success img',
      { state: 'attached', timeout: 15000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    // Ensure no stale viewer is open from a prior test.
    const open = await viewerVisible(page)
    if (open) {
      await page.keyboard.press('Escape')
      await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)
    }
    // Restore a real text caret in the image's paragraph before each test.
    // After a Space-preview/Escape cycle the paragraph stays the active block
    // but its DOM selection is null; re-clicking the image from that state
    // trips a pre-existing engine `blurHandler` crash (see the `bug` report) —
    // unrelated to the viewer feature under test. Clicking the paragraph
    // content span gives the block a live selection so each test starts clean,
    // matching how a real user always has a caret somewhere.
    await page
      .locator('.editor-component .mu-paragraph-content')
      .first()
      .click({ position: { x: 2, y: 2 }, timeout: 5000 })
      .catch(() => {})
    await page.waitForTimeout(120)
    await clearRendererErrors(app)
  })

  test('image renders as a selectable inline image', async() => {
    const imgCount = await page
      .locator('.editor-component .mu-inline-image .mu-image-container img')
      .count()
    expect(imgCount).toBeGreaterThanOrEqual(1)
    // Viewer starts hidden.
    expect(await viewerVisible(page)).toBe(false)
  })

  test('Space on a selected image opens the .image-viewer overlay', async() => {
    await selectImage(page)
    await page.keyboard.press('Space')

    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)
    // The SimpleImageViewer mounts an <img> with the selected src into the
    // overlay container.
    await expect.poll(() => viewerImgCount(page), { timeout: 5000 }).toBeGreaterThanOrEqual(1)

    const overlaySrc = await page.locator('.image-viewer img').first().getAttribute('src')
    expect(overlaySrc).toBe(SVG_DATA_URI)

    await expectNoRendererErrors(app)
  })

  test('Esc closes the viewer and destroys its mounted image', async() => {
    await selectImage(page)
    await page.keyboard.press('Space')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)

    await page.keyboard.press('Escape')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)
    // setImageViewerVisible(false) calls imageViewer.destroy(), which empties
    // the container, so no <img> remains mounted in the overlay.
    await expect.poll(() => viewerImgCount(page), { timeout: 5000 }).toBe(0)

    await expectNoRendererErrors(app)
  })

  test('Space on a selected image does NOT insert a literal space into the markdown', async() => {
    const before = await getMarkdownContent(page, app)

    await selectImage(page)
    await page.keyboard.press('Space')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)

    // Close the viewer before reading the document so getMarkdownContent's
    // source-mode toggle is not racing the overlay.
    await page.keyboard.press('Escape')
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)

    const after = await getMarkdownContent(page, app)
    expect(after.trim()).toBe(before.trim())
    // The original image markdown is intact (no stray space injected).
    expect(after).toContain(`![alt](${SVG_DATA_URI})`)

    await expectNoRendererErrors(app)
  })

  // Item 130 — Cmd/Ctrl-click on an image opens the same SimpleImageViewer via
  // the `format-click` bus handler (editor.vue:1847).
  test('Cmd/Ctrl-click on an image opens the same viewer', async() => {
    const img = page
      .locator('.editor-component .mu-inline-image .mu-image-container img')
      .first()
    await img.waitFor({ state: 'attached', timeout: 15000 })
    await img.click({ timeout: 5000, modifiers: [modifierKey] })

    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)
    await expect.poll(() => viewerImgCount(page), { timeout: 5000 }).toBeGreaterThanOrEqual(1)

    const overlaySrc = await page.locator('.image-viewer img').first().getAttribute('src')
    expect(overlaySrc).toBe(SVG_DATA_URI)

    // Close via the overlay's close affordance (the .icon-close span calls
    // setImageViewerVisible(false)).
    await page.locator('.image-viewer .icon-close').click({ timeout: 5000 })
    await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)
    await expect.poll(() => viewerImgCount(page), { timeout: 5000 }).toBe(0)

    await expectNoRendererErrors(app)
  })
})
