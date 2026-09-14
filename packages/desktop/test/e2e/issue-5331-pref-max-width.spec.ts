import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// #5331: Preferences › Editor › Max width only accepts a number followed by
// px, ch or %. A bare number used to turn red without saying why.

const MAX_WIDTH_INPUT = '.pref-editor .pref-text-box-item input'

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
  await settings.waitForSelector(MAX_WIDTH_INPUT, { timeout: 15000 })
  return settings
}

const editorMaxWidth = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const container = document.querySelector('.mu-container')
    return container ? getComputedStyle(container).maxWidth : ''
  })

test.describe('Preferences max width (#5331)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Max width\n\nSome text.\n')
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-container', { timeout: 15000 })
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('a number without a unit explains the format and is not saved', async() => {
    const settings = await openEditorPreferences(app)
    const input = settings.locator(MAX_WIDTH_INPUT).first()
    const error = settings.locator('.pref-text-box-item .error-message')
    const defaultWidth = await editorMaxWidth(page)

    await expect(settings.locator('.pref-editor .pref-text-box-item .notes').first()).toContainText(
      '800px'
    )

    await input.fill('600')
    await expect(error).toBeVisible()
    await expect(error).toContainText('800px')
    await settings.waitForTimeout(1500)
    expect(await editorMaxWidth(page)).toBe(defaultWidth)

    await input.fill('600px')
    await expect(error).toBeHidden()
    await expect.poll(() => editorMaxWidth(page)).toBe('700px')
  })
})
