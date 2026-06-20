import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  clickMenuById,
  placeCaretInEditor,
  sendIpcToRenderer,
  setSourceMarkdown,
  expectNoRendererErrors,
  clearRendererErrors
} from './helpers'

// Item 113 — Format -> Image desktop e2e wiring.
//
// The engine path (empty-image placeholder + click opens the edit tool) is
// already proven in packages/muya/e2e/tests/ui/image-tools.spec.ts. What only
// exists in the desktop renderer (editor.vue) is the menu/IPC chain:
//
//   Format -> Image menu  (main: menu/actions/format.ts `image`)
//     -> ipc 'mt::editor-format-action' { type: 'image' }
//     -> renderer store/listenForMain.ts re-emits bus 'format'
//     -> editor.vue handleInlineFormat -> editor.value.format('image')
//     -> muya block/base/format.ts inserts `![]()` and, inside a
//        requestAnimationFrame, emits 'muya-image-selector' for the empty
//        placeholder
//     -> ImageEditTool (mu-image-selector) shows + focuses its `input.src`.
//
// These tests drive the real built Electron app and assert the float renders
// with a focused src input. Because the engine emits the selector inside a
// rAF, all assertions poll rather than checking synchronously.

const srcInput = '.mu-image-selector input.src'

// Whether the ImageEditTool's src input currently exists and is the focused
// element. Checking activeElement directly avoids racing the rAF that
// Playwright's toBeFocused can hit.
const isSrcInputFocused = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    return (
      !!active &&
      active.tagName === 'INPUT' &&
      active.classList.contains('src') &&
      !!active.closest('.mu-image-selector')
    )
  })

// baseFloat shows a float by writing inline `opacity: 1` on its
// `.mu-float-wrapper` once `computePosition` resolves; hidden floats keep the
// CSS default opacity 0 (see packages/muya/src/ui/baseFloat). Playwright's
// toBeVisible ignores opacity, so the inline opacity is the reliable signal.
const toolShown = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const tool = document.querySelector('.mu-image-selector')
    const wrapper = tool?.closest('.mu-float-wrapper') as HTMLElement | null
    return Number.parseFloat(wrapper?.style.opacity || '0') > 0
  })

// Reset the editor to a single empty paragraph and dismiss any open edit tool,
// so each test starts from a clean state. The tool is launched in beforeAll;
// resetting via source mode also moves focus out of any prior float.
const resetToEmpty = async(page: Page, app: ElectronApplication): Promise<void> => {
  // A document `click` outside the float hides it (baseFloat attaches a
  // document-level click → hide). Escape only fires the hide when the keydown
  // lands on the editor `domNode`, but focus is in the float's input, so a
  // neutral click is the reliable dismiss.
  if (await toolShown(page)) {
    await page.mouse.click(5, 5)
    await expect.poll(() => toolShown(page), { timeout: 5000 }).toBe(false)
  }
  await setSourceMarkdown(page, app, '\n')
  await placeCaretInEditor(page)
  await clearRendererErrors(app)
}

test.describe('Format -> Image edit tool wiring', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    await resetToEmpty(page, app)
  })

  test('IPC mt::editor-format-action {image} opens the edit tool with a focused src input', async() => {
    await sendIpcToRenderer(app, 'mt::editor-format-action', { type: 'image' })

    // The empty `![]()` placeholder is inserted and the edit tool float renders
    // and is shown (inline opacity 1 on its wrapper).
    await page.waitForSelector(srcInput, { state: 'attached', timeout: 5000 })
    await expect(page.locator('.mu-image-selector input.src')).toHaveCount(1)
    await expect.poll(() => toolShown(page), { timeout: 5000 }).toBe(true)

    // The src input is auto-focused for quick editing (_focusSrcInput()).
    await expect.poll(() => isSrcInputFocused(page), { timeout: 5000 }).toBe(true)

    await expectNoRendererErrors(app)
  })

  test('Format -> Image menu item opens the edit tool with a focused src input', async() => {
    await clickMenuById(app, 'imageMenuItem')

    await page.waitForSelector(srcInput, { state: 'attached', timeout: 5000 })
    await expect.poll(() => toolShown(page), { timeout: 5000 }).toBe(true)
    await expect.poll(() => isSrcInputFocused(page), { timeout: 5000 }).toBe(true)

    // The action did not crash the renderer.
    const crashed = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.isCrashed()
    )
    expect(crashed).toBe(false)
    await expectNoRendererErrors(app)
  })

  test('The opened edit tool is the empty link/embed editor (src input, no value)', async() => {
    await sendIpcToRenderer(app, 'mt::editor-format-action', { type: 'image' })

    await page.waitForSelector(srcInput, { state: 'attached', timeout: 5000 })
    await expect.poll(() => toolShown(page), { timeout: 5000 }).toBe(true)

    // A freshly inserted `![]()` has no source, so the src input starts empty.
    await expect.poll(
      () =>
        page.evaluate(() => {
          const input = document.querySelector(
            '.mu-image-selector input.src'
          ) as HTMLInputElement | null
          return input ? input.value : null
        }),
      { timeout: 5000 }
    ).toBe('')

    await expectNoRendererErrors(app)
  })
})
