import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchWithMarkdown, clickMenuById } from './helpers'

const darkTheme = `/*!
 * @name E2E Dark
 * @type dark
 */
:root {
  --themeColor: #ff0000;
  --editorBgColor: #101418;
  --editorColor: #e6e6e6;
}
`

const lightTheme = `/*!
 * @name E2E Light
 * @type light
 */
:root {
  --themeColor: #0033cc;
}
`

test.describe('Custom (imported) editor themes', () => {
  let app: ElectronApplication
  let page: Page
  let userDataDir: string

  test.beforeAll(async() => {
    // Pre-seed two custom themes in <userData>/themes/editor before launch so
    // they are discovered by the renderer (on load) and the native menu (built
    // on startup).
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2e-customtheme-'))
    const editorThemes = path.join(userDataDir, 'themes', 'editor')
    fs.mkdirSync(editorThemes, { recursive: true })
    fs.writeFileSync(path.join(editorThemes, 'e2e-dark.theme.css'), darkTheme, 'utf-8')
    fs.writeFileSync(path.join(editorThemes, 'e2e-light.theme.css'), lightTheme, 'utf-8')

    const launched = await launchWithMarkdown('# Custom theme test\n', { userDataDir })
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('exposes themes from <userData>/themes/editor over IPC', async() => {
    const ids = await page.evaluate(async() => {
      const themes = await window.themes.listCustom()
      return themes.map((theme) => theme.id)
    })
    expect(ids).toContain('custom:e2e-dark')
    expect(ids).toContain('custom:e2e-light')
  })

  test('applies a custom dark theme (body.dark) from the Theme menu', async() => {
    await clickMenuById(app, 'custom:e2e-dark')
    await expect(page.locator('body')).toHaveClass(/(^|\s)dark(\s|$)/)
  })

  test('injects the custom theme CSS into the document', async() => {
    await clickMenuById(app, 'custom:e2e-dark')
    const injected = await page.evaluate(() =>
      Array.from(document.querySelectorAll('style')).some((styleEl) =>
        (styleEl.textContent ?? '').includes('--themeColor: #ff0000')
      )
    )
    expect(injected).toBe(true)
  })

  test('applies a custom light theme and removes body.dark', async() => {
    await clickMenuById(app, 'custom:e2e-light')
    await page.waitForFunction(() => !document.body.classList.contains('dark'), null, {
      timeout: 5000
    })
    expect(await page.evaluate(() => document.body.classList.contains('dark'))).toBe(false)
  })
})
