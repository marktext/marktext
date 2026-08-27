import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { expectNoRendererErrors, launchWithMarkdown } from './helpers'

const FRONTMATTER_DOC = '---\ntitle: Example\nauthor: Tester\n---\n\nBody\n'
const FRONTMATTER = '.editor-component .mu-frontmatter'

const setPreference = async(page: Page, value: boolean): Promise<void> => {
  await page.evaluate((frontmatterDefaultCollapsed) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', {
      frontmatterDefaultCollapsed
    })
  }, value)
}

test.describe('frontmatter property disclosure preference', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(FRONTMATTER_DOC, {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await page.waitForSelector(FRONTMATTER, { state: 'attached', timeout: 15000 })
  })

  test.afterAll(async() => {
    if (page) await setPreference(page, true)
    if (app) await app.close()
  })

  test('starts collapsed and the Properties control expands it', async() => {
    const frontmatter = page.locator(FRONTMATTER)
    const toggle = frontmatter.locator('.mu-frontmatter-toggle')

    await expect(frontmatter).toHaveClass(/mu-frontmatter-collapsed/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(frontmatter.locator('.mu-code')).toBeHidden()

    await toggle.click()
    await expect(frontmatter).not.toHaveClass(/mu-frontmatter-collapsed/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(frontmatter.locator('.mu-code')).toBeVisible()
    await expectNoRendererErrors(app)
  })

  test('applies collapsed and expanded defaults live from preferences', async() => {
    await setPreference(page, false)
    await expect(page.locator(FRONTMATTER)).not.toHaveClass(/mu-frontmatter-collapsed/)
    await expect(page.locator(`${FRONTMATTER} .mu-code`)).toBeVisible()

    await setPreference(page, true)
    await expect(page.locator(FRONTMATTER)).toHaveClass(/mu-frontmatter-collapsed/)
    await expect(page.locator(`${FRONTMATTER} .mu-code`)).toBeHidden()

    await setPreference(page, false)
    await expect(page.locator(FRONTMATTER)).not.toHaveClass(/mu-frontmatter-collapsed/)
    await expect(page.locator(`${FRONTMATTER} .mu-code`)).toBeVisible()
    await expectNoRendererErrors(app)
  })
})
