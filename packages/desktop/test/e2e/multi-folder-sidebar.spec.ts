import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import {
  expectNoRendererErrors,
  getElectronPath,
  launchElectron,
  sendIpcToRenderer
} from './helpers'

test('multi-folder sidebar completes add, search, remove and restore (#2222)', async() => {
  test.setTimeout(90000)
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-multi-folder-'))
  const directories = ['work/notes', 'personal/notes', 'third'].map((name) =>
    path.join(fixture, name)
  )
  for (const directory of directories) {
    fs.mkdirSync(path.join(directory, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(directory, 'common.md'), '# Notes\n\nneedle2222\n')
    fs.writeFileSync(path.join(directory, 'nested', 'deep.md'), '# Deep\n')
  }
  let app: ElectronApplication | undefined
  let page: Page
  try {
    const launched = await launchElectron([directories[0]], {
      suppressErrorDialog: true,
      preferences: {
        language: 'en',
        startUpAction: 'restoreAll',
        sideBarVisibility: true,
        autoRevealInSidebar: false,
        openFolderInNewWindow: true
      }
    })
    app = launched.app
    page = launched.page
    const roots = () => page.locator('.project-root')
    await expect(roots()).toHaveCount(1)
    await expect(page.locator('.root-status')).toHaveCount(0)

    const choose = async(directory: string) => {
      await app!.evaluate(({ dialog }, selected) => {
        dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [selected] })
      }, directory)
    }
    await choose(directories[1])
    const plus = page.locator('.add-folder-button')
    await plus.click()
    await expect(roots()).toHaveCount(2)
    await expect(page.locator('.root-status')).toHaveCount(0)
    await expectNoRendererErrors(app)
    expect(app.windows().filter((window) => window.url() === page.url())).toHaveLength(1)
    await expect(roots().nth(0)).toContainText('work')
    await expect(roots().nth(1)).toContainText('personal')
    const sidebarBox = await page.locator('.side-bar').boundingBox()
    const plusBox = await plus.boundingBox()
    expect(plusBox!.y).toBeGreaterThan(sidebarBox!.y + sidebarBox!.height - 50)
    expect(plusBox!.x).toBeGreaterThan(sidebarBox!.x + sidebarBox!.width - 50)

    await plus.click()
    await expect(roots()).toHaveCount(2)
    await choose(directories[2])
    await plus.click()
    await expect(roots()).toHaveCount(3)
    await expect(page.locator('.root-status')).toHaveCount(0)

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open')
    const quickInput = page.locator('input.search:visible').first()
    await expect(quickInput).toHaveAttribute('placeholder', 'Search file to open')
    await expect(quickInput).toHaveValue('')
    await quickInput.pressSequentially('common')
    await expect(page.locator('.commands li:visible')).toHaveCount(3)
    await quickInput.press('Escape')

    await page.locator('.side-bar .search-button').click()
    const search = page.locator('.side-bar-search .search-input')
    await search.fill('needle2222')
    await search.press('Enter')
    await expect(page.locator('.search-result-item')).toHaveCount(3)
    await expect(page.locator('.source-path').first()).toContainText('common.md')
    await page.locator('.back-button').click()

    const secondFile = page
      .locator('.project-tree')
      .nth(1)
      .locator('.side-bar-file')
      .filter({ hasText: 'common.md' })
    await secondFile.dblclick()
    await expect(page.locator('.mu-editor')).toBeVisible()
    await page.locator('.mu-editor').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
    await page.keyboard.type('unsaved2222')
    const canonicalB = fs.realpathSync(directories[1])
    await page.evaluate(
      (key) => window.electron.ipcRenderer.invoke('mt::project-remove-root', key),
      canonicalB
    )
    await expect(roots()).toHaveCount(2)
    await expect(page.locator('.mu-editor')).toContainText('unsaved2222')
    expect(fs.readFileSync(path.join(directories[1], 'common.md'), 'utf8')).not.toContain(
      'unsaved2222'
    )
    expect(fs.existsSync(directories[1])).toBe(true)

    await roots().first().click()
    await expect(roots().first()).toHaveAttribute('aria-expanded', 'false')
    const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    await expectNoRendererErrors(app)
    const closed = app.waitForEvent('close')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::app-try-quit'))
    await closed
    app = await _electron.launch({
      executablePath: getElectronPath(),
      args: [path.resolve(__dirname, '../..'), '--user-data-dir', userData],
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, MARKTEXT_ERROR_INTERACTION: '1' }
    })
    page = await app.firstWindow()
    await expect(roots()).toHaveCount(2)
    await expect(page.locator('.root-status')).toHaveCount(0)
    await expect(roots().first()).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.mu-editor')).toContainText('unsaved2222')
    await expect(roots().nth(1)).toContainText('third')
  } finally {
    if (app) await app.close().catch(() => {})
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})
