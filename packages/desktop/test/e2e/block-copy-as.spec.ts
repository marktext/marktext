import { expect, test } from '@playwright/test'
import { backupClipboard, readClipboardState, restoreClipboard } from './clipboardHelpers'
import { launchWithMarkdown } from './helpers'

test('the block menu copies a whole block as Markdown, HTML or Rich Text (#5808)', async() => {
  const { app, page } = await launchWithMarkdown('Some **bold** text\n\n```js\nconst a = 1;\n```\n')
  await backupClipboard(app)
  try {
    const copyAs = async(target: string, format: string) => {
      await page.locator(target).first().hover()
      await page.locator('.mu-front-button').click()
      const menu = page.locator('.mu-front-menu')
      await expect(menu.locator('..')).toHaveCSS('opacity', '1')
      await menu.locator('li.copy-as').hover()
      await menu.locator(`li.copy-as-${format}`).click()
      await expect(menu.locator('..')).toHaveCSS('opacity', '0') // hide() moves the float off-screen
    }

    await copyAs('pre', 'markdown')
    await expect.poll(async() => (await readClipboardState(app)).text).toBe('```js\nconst a = 1;\n```\n')

    await copyAs('.mu-paragraph-content', 'html')
    await expect.poll(async() => (await readClipboardState(app)).text).toContain('<strong>bold</strong>')

    await copyAs('.mu-paragraph-content', 'rich')
    await expect.poll(async() => (await readClipboardState(app)).html).toContain('<strong>bold</strong>')
    expect((await readClipboardState(app)).text).toBe('Some **bold** text\n')
  } finally {
    await restoreClipboard(app)
    await app.close()
  }
})
