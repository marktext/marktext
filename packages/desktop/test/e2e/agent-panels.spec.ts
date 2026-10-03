import path from 'node:path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { clickMenuById, launchElectron, waitForMenuReady } from './helpers'

const repoRoot = path.resolve(__dirname, '../../../..')

test.describe('Agent panels', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron([repoRoot])
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await page.waitForSelector('.agent-panel', { timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('keeps the editor at least 820 px wide at 1366 px', async() => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win.isMaximized()) win.unmaximize()
      win.setContentSize(1366, 768)
    })
    await page.waitForFunction(() => window.innerWidth <= 1366)

    const middle = await page.evaluate(
      () => Math.round(document.querySelector('.editor-middle')?.getBoundingClientRect().width ?? 0)
    )
    expect(middle).toBeGreaterThanOrEqual(820)
  })

  test('hides and shows the agent panel and the terminal from the View menu', async() => {
    await clickMenuById(app, 'agentPanelMenuItem')
    await expect(page.locator('.agent-panel')).toHaveCount(0)

    await clickMenuById(app, 'agentPanelMenuItem')
    await expect(page.locator('.agent-panel')).toBeVisible()

    await clickMenuById(app, 'terminalPanelMenuItem')
    await expect(page.locator('.terminal')).toBeVisible()

    await clickMenuById(app, 'terminalPanelMenuItem')
    await expect(page.locator('.terminal')).toBeHidden()
    await expect(page.locator('.term-handle')).toBeVisible()
  })
})
