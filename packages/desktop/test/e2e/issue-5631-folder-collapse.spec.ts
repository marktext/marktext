import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #5631 — the Files tree is under a v-if, so switching to another sidebar view
// remounts every folder. Expanded folders must stay expanded across that.

const sideBarIcon = (page: Page, index: number) =>
  page.locator('.side-bar .left-column > ul').first().locator('li').nth(index)

const folderName = (page: Page, name: string) =>
  page.locator('.side-bar-folder > .folder-name', { hasText: name })

test.describe('#5631 folder collapse state survives a sidebar view switch', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-5631-'))
    fs.writeFileSync(path.join(projectDir, 'readme.md'), '# Readme\n', 'utf-8')
    fs.mkdirSync(path.join(projectDir, 'sub', 'nested'), { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'sub', 'nested', 'note.md'), '# Note\n', 'utf-8')

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

  test('expanded folders stay expanded after switching to TOC and back', async() => {
    await expect(folderName(page, 'sub')).toBeVisible()
    await expect(folderName(page, 'nested')).toHaveCount(0)

    await folderName(page, 'sub').click()
    await folderName(page, 'nested').click()
    await expect(page.locator('.side-bar-file[title$="note.md"]')).toBeVisible()

    await sideBarIcon(page, 2).click() // TOC
    await expect(folderName(page, 'sub')).toHaveCount(0)
    await sideBarIcon(page, 0).click() // Files

    await expect(page.locator('.side-bar-file[title$="note.md"]')).toBeVisible()
    await expect(folderName(page, 'sub').locator('.icon-arrow')).not.toHaveClass(/\bfold\b/)
    await expect(folderName(page, 'nested').locator('.icon-arrow')).not.toHaveClass(/\bfold\b/)
  })
})
