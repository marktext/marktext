import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { clickMenuById, launchElectron, openProjectFolder, typeIntoEditor } from './helpers'

const tabFor = (page: Page, filename: string) =>
  page.locator(`.tabs-container > li[title$="${filename}"]`)

const tabCount = (page: Page): Promise<number> => page.locator('.tabs-container > li').count()

test.describe('Issue #2395 sidebar preview tabs', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  const launchProject = async(preferences: Record<string, unknown> = {}): Promise<void> => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-preview-'))
    for (const name of ['alpha', 'beta', 'gamma']) {
      fs.writeFileSync(path.join(projectDir, `${name}.md`), `# ${name}\n`, 'utf-8')
    }

    const launched = await launchElectron([], {
      preferences: {
        sideBarVisibility: true,
        tabBarVisibility: true,
        openFilesInPreviewMode: true,
        autoRevealInSidebar: true,
        ...preferences
      }
    })
    app = launched.app
    page = launched.page
    await openProjectFolder(app, page, projectDir, path.join(projectDir, 'alpha.md'))
  }

  test.afterEach(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('single clicks reuse one preview tab', async() => {
    await launchProject()

    await page.locator('.side-bar-file[title$="alpha.md"]').click()
    await expect(tabFor(page, 'alpha.md')).toHaveClass(/preview/)
    await expect.poll(() => tabCount(page)).toBe(1)

    await page.locator('.side-bar-file[title$="beta.md"]').click()
    await expect(tabFor(page, 'beta.md')).toHaveClass(/preview/)
    await expect(tabFor(page, 'alpha.md')).toHaveCount(0)
    await expect.poll(() => tabCount(page)).toBe(1)

    await page.locator('.side-bar-file[title$="gamma.md"]').click()
    await expect(tabFor(page, 'gamma.md')).toHaveClass(/preview/)
    await expect.poll(() => tabCount(page)).toBe(1)
  })

  test('editing pins the preview and the next file gets a new preview', async() => {
    await launchProject()
    await page.locator('.side-bar-file[title$="alpha.md"]').click()
    await expect(tabFor(page, 'alpha.md')).toHaveClass(/preview/)

    await typeIntoEditor(page, ' edited')

    await expect(tabFor(page, 'alpha.md')).not.toHaveClass(/preview/)
    await page.locator('.side-bar-file[title$="beta.md"]').click()

    await expect(tabFor(page, 'alpha.md')).toHaveCount(1)
    await expect(tabFor(page, 'beta.md')).toHaveClass(/preview/)
    await expect.poll(() => tabCount(page)).toBe(2)
  })

  test('double-clicking a preview pins it without creating another tab', async() => {
    await launchProject()
    const row = page.locator('.side-bar-file[title$="alpha.md"]')

    await row.dblclick()

    await expect(tabFor(page, 'alpha.md')).toHaveCount(1)
    await expect(tabFor(page, 'alpha.md')).not.toHaveClass(/preview/)
  })

  test('disabling preview mode restores one tab per file', async() => {
    await launchProject({ openFilesInPreviewMode: false })

    await page.locator('.side-bar-file[title$="alpha.md"]').click()
    await page.locator('.side-bar-file[title$="beta.md"]').click()

    await expect(tabFor(page, 'alpha.md')).not.toHaveClass(/preview/)
    await expect(tabFor(page, 'beta.md')).not.toHaveClass(/preview/)
    await expect.poll(() => tabCount(page)).toBe(2)
  })

  test('preview browsing does not reveal a hidden tab bar', async() => {
    await launchProject()
    await clickMenuById(app, 'tabBarMenuItem')
    await expect(page.locator('.editor-tabs')).toBeHidden()

    await page.locator('.side-bar-file[title$="alpha.md"]').click()
    await expect(tabFor(page, 'alpha.md')).toHaveClass(/preview/)
    await page.locator('.side-bar-file[title$="beta.md"]').click()

    await expect(page.locator('.editor-tabs')).toBeHidden()
    await expect.poll(() => tabCount(page)).toBe(1)
  })

  test('rapid A-B-A clicks leave the last A request as the only preview', async() => {
    await launchProject()

    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.side-bar-file'))
      const alpha = rows.find((row) => row.getAttribute('title')?.endsWith('alpha.md'))
      const beta = rows.find((row) => row.getAttribute('title')?.endsWith('beta.md'))
      ;(alpha as HTMLElement | undefined)?.click()
      ;(beta as HTMLElement | undefined)?.click()
      ;(alpha as HTMLElement | undefined)?.click()
    })

    await expect(tabFor(page, 'alpha.md')).toHaveClass(/preview/)
    await expect.poll(() => tabCount(page)).toBe(1)
    await expect(tabFor(page, 'beta.md')).toHaveCount(0)
  })
})
