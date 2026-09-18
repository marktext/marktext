import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, exitSourceMode, launchWithMarkdown } from './helpers'

// More than ten lines, so the old formatter that only labelled line 1 and
// every tenth line would fail the every-line assertion.
const MARKDOWN = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n\n') + '\n'

const setPreference = async(page: Page, prefs: Record<string, unknown>): Promise<void> => {
  await page.evaluate((payload) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', payload)
  }, prefs)
}

const openEditorPreferences = async(app: ElectronApplication): Promise<Page> => {
  const settingsWindow = app.waitForEvent('window')
  await app.evaluate(({ ipcMain }) => {
    ipcMain.emit('app-create-settings-window')
  })
  const settings = await settingsWindow
  await settings.waitForSelector('.pref-container', { timeout: 15000 })
  await settings.evaluate(() => {
    location.hash = '#/preference/editor'
  })
  await settings.waitForSelector('.pref-editor', { timeout: 15000 })
  return settings
}

const readGutter = (page: Page): Promise<{ lineCount: number; numbers: string[] }> =>
  page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { lineCount(): number } })
      | null
    // `.CodeMirror-measure` holds a hidden line-number probe; only count the
    // ones rendered next to lines.
    const numbers = Array.from(
      document.querySelectorAll('.source-code .CodeMirror-code .CodeMirror-linenumber'),
      (el) => el.textContent ?? ''
    )
    return { lineCount: cm?.CodeMirror?.lineCount() ?? 0, numbers }
  })

const everyLineNumbered = async(page: Page): Promise<boolean> => {
  const { lineCount, numbers } = await readGutter(page)
  return (
    lineCount > 10 &&
    numbers.length === lineCount &&
    numbers.every((text, i) => text === String(i + 1))
  )
}

test.describe('Source code mode line numbers preference', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(MARKDOWN)
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('numbers every line by default', async() => {
    await enterSourceMode(page, app)
    await expect.poll(() => everyLineNumbered(page), { timeout: 10000 }).toBe(true)
    await exitSourceMode(page, app)
  })

  test('the Preferences switch hides and restores the whole gutter', async() => {
    await enterSourceMode(page, app)
    await expect.poll(() => everyLineNumbered(page), { timeout: 10000 }).toBe(true)

    // The switch is found by its label, and first launch picks the system language.
    await setPreference(page, { language: 'en' })
    const settings = await openEditorPreferences(app)
    const toggle = settings
      .locator('.pref-switch-item', { hasText: 'Show line numbers in source code mode' })
      .locator('.el-switch')
    await expect(toggle).toHaveClass(/is-checked/)

    await toggle.click()
    await expect
      .poll(async() => (await readGutter(page)).numbers.length, { timeout: 10000 })
      .toBe(0)

    // clickMenuById targets the focused window, so close the settings window
    // before toggling source mode again.
    await settings.close()

    // A fresh CodeMirror instance must read the preference on mount too.
    await exitSourceMode(page, app)
    await enterSourceMode(page, app)
    expect((await readGutter(page)).lineCount).toBeGreaterThan(10)
    expect((await readGutter(page)).numbers).toEqual([])

    await setPreference(page, { sourceCodeLineNumbers: true })
    await expect.poll(() => everyLineNumbered(page), { timeout: 10000 }).toBe(true)

    await exitSourceMode(page, app)
  })
})
