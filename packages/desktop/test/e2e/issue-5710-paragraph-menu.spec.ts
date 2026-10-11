import { expect, test } from '@playwright/test'
import { clickMenuById, getMarkdownContent, launchWithMarkdown } from './helpers'

test('paragraph menu stays inside the window with the sidebar hidden (#5710)', async() => {
  const { app, page } = await launchWithMarkdown('Paragraph menu regression\n')
  try {
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(800, 600)
    })
    if (await page.locator('.side-bar').isVisible()) {
      await clickMenuById(app, 'sideBarMenuItem')
    }
    await expect(page.locator('.side-bar')).toBeHidden()

    await page.locator('.mu-paragraph-content').first().hover()
    const button = page.locator('.mu-front-button')
    await expect(button).toBeVisible()
    await button.click()

    const menu = page.locator('.mu-front-menu')
    await expect(menu).toBeVisible()
    await expect.poll(async() => {
      const bounds = await menu.boundingBox()
      return bounds?.x ?? -9999
    }).toBeGreaterThanOrEqual(0)
    const bounds = await menu.boundingBox()
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewportWidth)

    await menu.locator('.turn-into-item.atx-heading').first().click()
    await expect.poll(() => getMarkdownContent(page, app)).toMatch(/^# Paragraph menu regression/)
  } finally {
    await app.close()
  }
})
