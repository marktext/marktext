import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #1618 — rename the sidebar selection from the keyboard with the VS Code
// accelerator (F2) and the Finder / Windows Explorer gesture (Enter). The inline
// input opens with the file stem preselected so typing keeps the extension.

test.describe('Sidebar rename shortcuts (#1618)', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-1618-'))
    fs.writeFileSync(path.join(projectDir, 'first.md'), '# First\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'second.md'), '# Second\n', 'utf-8')
    fs.mkdirSync(path.join(projectDir, 'docs'))
    fs.writeFileSync(path.join(projectDir, 'docs', 'inner.md'), '# Inner\n', 'utf-8')

    const launched = await launchElectron([projectDir])
    app = launched.app
    page = launched.page
    // Opening a directory can attach to a window other than the first one.
    await expect
      .poll(
        async() => {
          for (const candidate of app.windows()) {
            if (await candidate.locator('.side-bar-file').count()) {
              page = candidate
              return true
            }
          }
          return false
        },
        { timeout: 15000 }
      )
      .toBe(true)
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('single click keeps tree focus, then F2 renames and preselects the stem', async() => {
    const file = page.locator('.side-bar-file[title$="second.md"]').first()
    await file.click()

    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('.tree-wrapper')))
      .toBe(true)
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('.mu-editor')))
      .toBe(false)

    await page.keyboard.press('F2')
    const input = file.locator('input.rename')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('second.md')

    expect(
      await input.evaluate((el) => {
        const i = el as HTMLInputElement
        return [i.selectionStart, i.selectionEnd, i.value.length]
      })
    ).toEqual([0, 6, 9])

    await page.keyboard.type('renamed')
    await page.keyboard.press('Enter')
    await expect.poll(() => fs.existsSync(path.join(projectDir, 'renamed.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'second.md'))).toBe(false)
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('.tree-wrapper')))
      .toBe(true)
  })

  test('double click focuses the editor, where Enter stays a line break', async() => {
    const file = page.locator('.side-bar-file[title$="first.md"]').first()
    await file.dblclick()
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('.mu-editor')))
      .toBe(true)

    await page.keyboard.press('Enter')

    await expect(page.locator('input.rename')).toHaveCount(0)
    expect(fs.existsSync(path.join(projectDir, 'first.md'))).toBe(true)
  })

  test('Enter renames the selected folder (sidebar keeps focus)', async() => {
    const folderName = page
      .locator('.side-bar-folder .folder-name[title$="docs"]')
      .first()
    await folderName.click()
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('.tree-wrapper')))
      .toBe(true)

    await page.keyboard.press('Enter')
    const input = folderName.locator('input.rename')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('docs')

    await page.keyboard.type('guides')
    await page.keyboard.press('Enter')
    await expect.poll(() => fs.existsSync(path.join(projectDir, 'guides'))).toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'docs'))).toBe(false)
  })
})
