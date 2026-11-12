import { expect, test } from '@playwright/test'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

for (let level = 1; level <= 6; level++) {
  test(`H${level} keeps its section folded after switching tabs (#6054)`, async() => {
    const markdown = `${'#'.repeat(level)} Section\n\nhidden body\n\n# Outside\n\nvisible body\n`
    const { app, page } = await launchWithMarkdown(markdown, {
      windowLayout: { showTabBar: true }
    })
    try {
      await expect(page.locator('.mu-paragraph')).toHaveText(['hidden body', 'visible body'])
      const toggle = page.locator('.mu-fold-toggle').first()
      const body = page.locator('.mu-paragraph').filter({ hasText: 'hidden body' })
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(body).toBeHidden()

      await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '# Other\n\nother body\n')
      await expect(page.locator('.mu-paragraph')).toHaveText(['other body'])
      await page.locator('.tabs-container > li').first().click()

      await expect(page.locator('.mu-paragraph')).toHaveText(['hidden body', 'visible body'])
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(body).toBeHidden()
      await expect(page.locator('.mu-paragraph').filter({ hasText: 'visible body' })).toBeVisible()
    } finally {
      await app.close()
    }
  })
}

test('keeps independent nested folds for tabs with identical headings', async() => {
  const markdown = '# Parent\n\nparent body\n\n## Child\n\nchild body\n\n# Outside\n'
  const { app, page } = await launchWithMarkdown(markdown, {
    windowLayout: { showTabBar: true }
  })
  const toggles = page.locator('.mu-fold-toggle')
  const childBody = page.locator('.mu-paragraph').filter({ hasText: 'child body' })
  const parentBody = page.locator('.mu-paragraph').filter({ hasText: 'parent body' })
  const switchTab = async(index: number): Promise<void> => {
    await page.locator('.tabs-container > li').nth(index).click()
    await expect(page.locator('.tabs-container > li').nth(index)).toHaveClass(/active/)
  }
  try {
    await expect(page.locator('.mu-paragraph')).toHaveText(['parent body', 'child body'])
    await toggles.nth(1).click()
    await toggles.first().click()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, markdown)
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await expect(toggles.first()).toHaveAttribute('aria-expanded', 'true')
    await expect(childBody).toBeVisible()

    await switchTab(0)
    await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false')
    await toggles.first().click()
    await expect(parentBody).toBeVisible()
    await expect(childBody).toBeHidden()
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false')

    await toggles.nth(1).click()
    await expect(childBody).toBeVisible()
    await switchTab(1)
    await toggles.first().click()
    await switchTab(0)
    await expect(parentBody).toBeVisible()
    await expect(childBody).toBeVisible()
    await expect(page.locator('.tabs-container > li.active')).not.toHaveClass(/unsaved/)
    await switchTab(1)
    await expect(parentBody).toBeHidden()
    await expect(childBody).toBeHidden()
  } finally {
    await app.close()
  }
})
