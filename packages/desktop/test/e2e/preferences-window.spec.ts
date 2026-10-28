import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expectNoRendererErrors, launchWithMarkdown } from './helpers'

const openSettings = async(app: ElectronApplication, editor: Page): Promise<Page> => {
  const opened = app.waitForEvent('window')
  await editor.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
  const settings = await opened
  await expect(settings.locator('.pref-general h4')).toBeVisible()
  await expect(settings.locator('.pref-sidebar input')).toBeVisible()
  return settings
}

const preferences = async(app: ElectronApplication): Promise<Record<string, unknown>> => {
  const directory = await app.evaluate(({ app }) => app.getPath('userData'))
  return JSON.parse(readFileSync(join(directory, 'preferences.json'), 'utf8'))
}

test('the full settings window indexes searchable controls without renderer exceptions', async() => {
  const { app, page } = await launchWithMarkdown('# Preferences\n', {
    preferences: { language: 'en', autoSave: false },
    suppressErrorDialog: true
  })
  try {
    const settings = await openSettings(app, page)
    await settings.locator('.pref-sidebar input').fill('auto')
    await expect(settings.locator('.pref-autocomplete li').first()).toBeVisible()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('actual settings clicks persist autosave and language and update the editor', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# Before\n', {
    preferences: { language: 'en', autoSave: false, autoSaveDelay: 1000 },
    suppressErrorDialog: true
  })
  try {
    const settings = await openSettings(app, page)
    const autoSave = settings.getByRole('switch', { name: 'Auto save', exact: true })
    await expect(autoSave).not.toBeChecked()
    await autoSave.locator('..').click()
    await expect(autoSave).toBeChecked()
    await expect.poll(async() => (await preferences(app)).autoSave).toBe(true)

    const language = settings.locator('.pref-select-item').filter({
      has: settings.getByRole('combobox', { name: 'Language', exact: true })
    })
    await language.locator('.el-select__wrapper').click()
    await settings.getByRole('option', { name: '简体中文', exact: true }).click()
    await expect(settings.locator('.pref-general h4')).toHaveText('通用')
    await expect.poll(async() => (await preferences(app)).language).toBe('zh-CN')
    await expect(settings.getByRole('switch', { name: '自动保存', exact: true })).toBeChecked()

    await page.locator('[contenteditable=true]').first().fill('Saved after enabling autosave')
    await expect.poll(() => readFileSync(filePath, 'utf8')).toContain('Saved after enabling autosave')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})


test('startup settings use shared controls and persist policy, switches and folder selection', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# Startup settings\n', {
    preferences: { language: 'en', autoSave: false },
    suppressErrorDialog: true
  })
  try {
    const settings = await openSettings(app, page)
    const startup = settings.locator('.recovery-settings')
    await expect(startup.locator('h6.title')).toHaveText('Startup Options')
    await expect(startup.locator('.el-switch')).toHaveCount(3)
    await expect(startup.locator('select')).toHaveCount(0)
    await expect(startup.locator('.startup-directory')).toHaveCount(0)
    await startup.locator('.el-select__wrapper').click()
    await settings.getByRole('option', { name: 'Restore the last active window', exact: true }).click()
    await expect.poll(async() => (await preferences(app)).startUpAction).toBe('restoreLastWindow')
    await expect(startup.locator('.startup-directory')).toHaveCount(0)
    const restoreFiles = startup.getByRole('switch', { name: 'Restore opened files', exact: true })
    await restoreFiles.locator('..').click()
    await expect(restoreFiles).not.toBeChecked()
    await expect.poll(async() => (await preferences(app)).restoreEditors).toBe(false)
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [folder] })
    }, dirname(filePath))
    await startup.locator('.el-select__wrapper').click()
    await settings.getByRole('option', { name: 'Open the selected folder', exact: true }).click()
    await expect(startup.locator('.startup-directory')).toBeVisible()
    await startup.getByRole('button', { name: 'Select Folder', exact: true }).click()
    await expect.poll(() => preferences(app)).toMatchObject({
      startUpAction: 'folder', defaultDirectoryToOpen: dirname(filePath), restoreEditors: false
    })
    await expect(startup.locator('.startup-directory')).toContainText(dirname(filePath))
    await startup.locator('.el-select__wrapper').click()
    await settings.getByRole('option', { name: 'New blank document', exact: true }).click()
    await expect(startup.locator('.startup-directory')).toHaveCount(0)
    await expect.poll(() => preferences(app)).toMatchObject({
      startUpAction: 'blank', defaultDirectoryToOpen: dirname(filePath)
    })
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
