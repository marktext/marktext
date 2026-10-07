import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #3207 / #3385 — clicking (or blurring) away from the sidebar's inline
// rename/create input must accept the edit like Finder / Windows Explorer,
// instead of silently discarding it.

test.describe('Sidebar name input commits on click-away (#3207)', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-3207-'))
    fs.writeFileSync(path.join(projectDir, 'first.md'), '# First\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'second.md'), '# Second\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'third.md'), '# Third\n', 'utf-8')
    fs.mkdirSync(path.join(projectDir, 'docs'))

    const launched = await launchElectron([projectDir])
    app = launched.app
    page = launched.page
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

    // Resolve the native sidebar context menu straight to "New File" so the
    // headless run does not hang on a real popup.
    await app.evaluate(({ ipcMain }) => {
      const findId = (items: Array<{ id?: string, submenu?: unknown }>): string | null => {
        for (const it of items || []) {
          if (it?.id && String(it.id).startsWith('newFileMenuItem')) return it.id
          if (it?.submenu) {
            const r = findId(it.submenu as Array<{ id?: string }>)
            if (r) return r
          }
        }
        return null
      }
      ipcMain.removeAllListeners('mt::menu::popup')
      ipcMain.on('mt::menu::popup', (event, template) => {
        const id = findId(template as Array<{ id?: string }>)
        if (id) {
          setTimeout(() => {
            try {
              event.sender.send('mt::menu::click', { id })
            } catch { /* window gone */ }
          }, 30)
        }
      })
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('renaming then clicking another row commits the new name', async() => {
    const target = page.locator('.side-bar-file[title$="first.md"]').first()
    await target.click()
    await page.keyboard.press('F2')

    const input = target.locator('input.rename')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    await input.pressSequentially('renamed', { delay: 20 })
    await expect(input).toHaveValue('renamed.md')
    // Click a different row instead of pressing Enter.
    await page.locator('.side-bar-file[title$="second.md"]').first().click()

    await expect.poll(() => fs.existsSync(path.join(projectDir, 'renamed.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'first.md'))).toBe(false)
  })

  test('creating a file then clicking away creates it', async() => {
    const folderName = page.locator('.side-bar-folder .folder-name[title$="docs"]').first()
    await folderName.click()
    await page.evaluate(() => {
      const fn = document.querySelector(
        '.side-bar-folder .folder-name[title$="docs"]'
      ) as HTMLElement | null
      if (!fn) throw new Error('no docs folder in sidebar')
      const r = fn.getBoundingClientRect()
      fn.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: r.left + 5,
          clientY: r.top + 5
        })
      )
    })

    const input = page
      .locator('.side-bar-folder .folder-contents input.new-input:visible')
      .first()
    await expect(input).toBeVisible()
    await input.pressSequentially('note', { delay: 20 })
    // Click another row (outside the input) to accept the create.
    await page.locator('.side-bar-file[title$="second.md"]').first().click()

    await expect.poll(() => fs.existsSync(path.join(projectDir, 'docs', 'note.md'))).toBe(true)
  })

  test('clicking the editor while renaming still commits', async() => {
    const target = page.locator('.side-bar-file[title$="second.md"]').first()
    await target.click()
    await page.keyboard.press('F2')

    const input = target.locator('input.rename')
    await expect(input).toBeVisible()
    await input.pressSequentially('renamed-two', { delay: 20 })

    // Click outside the tree entirely — the editor area.
    await page.locator('.mu-editor').first().click()

    await expect
      .poll(() => fs.existsSync(path.join(projectDir, 'renamed-two.md')))
      .toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'second.md'))).toBe(false)
  })

  test('clicking a @click.stop target (project heading) still commits', async() => {
    const target = page.locator('.side-bar-file[title$="third.md"]').first()
    await target.click()
    await page.keyboard.press('F2')

    const input = target.locator('input.rename')
    await expect(input).toBeVisible()
    await input.pressSequentially('renamed-three', { delay: 20 })

    // The project heading's collapse arrow calls event.stopPropagation().
    await page.locator('.project-tree > .title .icon-arrow').first().click()

    await expect
      .poll(() => fs.existsSync(path.join(projectDir, 'renamed-three.md')))
      .toBe(true)
    expect(fs.existsSync(path.join(projectDir, 'third.md'))).toBe(false)
  })
})
