import { expect, test } from '@playwright/test'
import {
  launchWithMarkdown,
  waitForMenuReady,
  getMarkdownContent,
  expectNoRendererErrors
} from './helpers'

test('typing immediately followed by source mode preserves the last character', async() => {
  const { app, page } = await launchWithMarkdown('start\n', { suppressErrorDialog: true })
  try {
    await waitForMenuReady(app)
    await page.locator('.mu-paragraph-content').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' typed-token', { delay: 0 })
    // Intentionally no text assertion or frame wait before switching modes.
    expect(await getMarkdownContent(page, app)).toContain('typed-token')
    expect(await getMarkdownContent(page, app)).toContain('typed-token')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
