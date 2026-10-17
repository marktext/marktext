import { expect, test } from '@playwright/test'
import { launchWithMarkdown, clickMenuById } from './helpers'

const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']

test('GitHub Alerts application submenu follows preferences and converts the selected alert', async() => {
  const { app, page } = await launchWithMarkdown('> [!NOTE]\n> Body', { preferences: { githubAlerts: true } })
  try {
    await expect(page.locator('.mu-github-alert')).toHaveCount(1)
    const menu = await app.evaluate(({ Menu }) => {
      const items = Menu.getApplicationMenu()?.getMenuItemById('githubAlertsMenuItem')?.submenu?.items ?? []
      return items.map(item => ({ label: item.label, accelerator: item.accelerator }))
    })
    expect(menu.map(item => item.label)).toEqual(types)
    expect(menu.every(item => !item.accelerator)).toBe(true)
    await page.locator('.mu-github-alert .mu-paragraph-content').first().click()
    await clickMenuById(app, 'githubAlertWARNINGMenuItem')
    await expect(page.locator('.mu-github-alert')).toHaveAttribute('data-alert-type', 'warning')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::set-user-preference', { githubAlerts: false }))
    await expect.poll(() => app.evaluate(({ Menu }) => !!Menu.getApplicationMenu()?.getMenuItemById('githubAlertsMenuItem'))).toBe(false)
  } finally {
    await app.close()
  }
})
