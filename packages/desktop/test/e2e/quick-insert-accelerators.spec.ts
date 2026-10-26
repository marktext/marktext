import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  setSourceMarkdown,
  placeCaretInEditor,
  getMarkdownContent
} from './helpers'

// Desktop command shortcuts must run through Electron's before-input-event;
// CDP keyboard input can bypass it and previously exercised Muya's hidden aliases.
// Injected events verify app dispatch, not OS-level shortcut availability.
const isMac = process.platform === 'darwin'
const modifiers = isMac ? ['meta', 'alt'] : ['control', 'shift']

test.describe('Quick-insert accelerators (item 49)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed paragraph\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    await setSourceMarkdown(page, app, '\n')
    await placeCaretInEditor(page)
    await page.click('.editor-component', { timeout: 5000 })
    await placeCaretInEditor(page)
  })

  const pressDesktopShortcut = async(keyCode: string) => {
    const window = await app.browserWindow(page)
    await window.evaluate((win, chord) => {
      win.webContents.sendInputEvent({ type: 'keyDown', ...chord })
      win.webContents.sendInputEvent({ type: 'keyUp', ...chord })
    }, { keyCode, modifiers })
  }

  test('the desktop code-block shortcut converts the empty paragraph', async() => {
    await pressDesktopShortcut(isMac ? 'C' : 'K')

    const codeBlock = page.locator('.editor-component pre.mu-code-block').first()
    await expect(codeBlock).toBeAttached({ timeout: 5000 })
    await expect(codeBlock.locator('.mu-codeblock-content').first()).toBeAttached()

    await expect.poll(() => getMarkdownContent(page, app)).toContain('```')

    await expect(page.locator('.editor-component blockquote.mu-block-quote')).toHaveCount(0)
  })

  test('the desktop quote shortcut converts the empty paragraph', async() => {
    await pressDesktopShortcut('Q')

    const quote = page.locator('.editor-component blockquote.mu-block-quote').first()
    await expect(quote).toBeAttached({ timeout: 5000 })

    await expect.poll(() => getMarkdownContent(page, app)).toMatch(/^>/m)

    await expect(page.locator('.editor-component pre.mu-code-block')).toHaveCount(0)
  })

  test('non-macOS windows ignore the old Muya Meta+Alt aliases', async() => {
    test.skip(isMac, 'These combinations are the desktop defaults on macOS')
    await page.keyboard.press('Meta+Alt+c')
    await page.keyboard.press('Meta+Alt+q')
    expect((await getMarkdownContent(page, app)).trim()).toBe('')
  })
})
