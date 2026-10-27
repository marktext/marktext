import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { clickMenuById, launchElectron, openProjectFolder, sendIpcToRenderer } from './helpers'

const expectTabBar = async(app: ElectronApplication, page: Page, visible: boolean) => {
  await expect(page.locator('.editor-tabs')).toBeVisible({ visible })
  await expect.poll(() => app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.getMenuItemById('tabBarMenuItem')?.checked
  )).toBe(visible)
}

const openFile = async(app: ElectronApplication, pathname: string) => {
  await app.evaluate(({ BrowserWindow, ipcMain }, target) => {
    const win = BrowserWindow.getAllWindows()[0]
    ipcMain.emit('app-open-file-by-id', win.id, target)
  }, pathname)
}

test.describe('Issue #5581 tab bar visibility', () => {
  let app: ElectronApplication
  let page: Page
  let directory: string

  test.beforeEach(async() => {
    directory = mkdtempSync(path.join(tmpdir(), 'marktext-5581-'))
    for (const filename of ['first.md', 'second.md']) {
      writeFileSync(path.join(directory, filename), `# ${filename}\n`)
    }
    const launched = await launchElectron([path.join(directory, 'first.md')], { windowLayout: { showTabBar: true },
      preferences: {
        language: 'en',
        restoreLayoutState: true,
        openFilesInNewWindow: false,
        openFilesInPreviewMode: false
      }
    })
    app = launched.app
    page = launched.page
    await expect(page.locator('.tabs-container > li')).toHaveCount(1)
  })

  test.afterEach(async() => {
    if (app) await app.close()
    if (directory) rmSync(directory, { recursive: true, force: true })
  })

  for (const remaining of [0, 1]) {
    test(`hidden tab bar stays hidden after closing to ${remaining} files and reopening`, async() => {
      const tabs = page.locator('.tabs-container > li')
      await openFile(app, path.join(directory, 'second.md'))
      await expect(tabs).toHaveCount(2)
      await clickMenuById(app, 'tabBarMenuItem')
      await expectTabBar(app, page, false)

      for (let count = 2; count > remaining; count--) {
        await sendIpcToRenderer(app, 'mt::editor-close-tab')
        await expect(tabs).toHaveCount(count - 1)
      }
      await expectTabBar(app, page, false)

      await openFile(app, path.join(directory, 'first.md'))
      await expect(tabs).toHaveCount(1)
      await openFile(app, path.join(directory, 'second.md'))
      await expect(tabs).toHaveCount(2)
      await expectTabBar(app, page, false)

      await clickMenuById(app, 'tabBarMenuItem')
      await expectTabBar(app, page, true)
    })
  }

  test('new tabs and opening folders preserve the selected visibility', async() => {
    await clickMenuById(app, 'tabBarMenuItem')
    await expectTabBar(app, page, false)

    await app.evaluate(({ Menu, BrowserWindow }) => {
      const fileMenu = Menu.getApplicationMenu()?.items.find(item => item.label === 'File')
      const newTab = fileMenu?.submenu?.items.find(item => item.label === 'New Tab')
      if (!newTab) throw new Error('New Tab menu item is missing')
      const win = BrowserWindow.getAllWindows()[0]
      newTab.click(undefined, win, win.webContents)
    })
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await expectTabBar(app, page, false)

    await openProjectFolder(app, page, directory, path.join(directory, 'first.md'))
    await expectTabBar(app, page, false)

    await clickMenuById(app, 'tabBarMenuItem')
    await expectTabBar(app, page, true)
    await openFile(app, path.join(directory, 'second.md'))
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await expectTabBar(app, page, true)
  })
})
