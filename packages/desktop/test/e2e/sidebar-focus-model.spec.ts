import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// The project tree is a DOM focus scope: clicking it takes focus (so F2 / Enter
// / Delete act on the sidebar), clicking outside moves focus away but keeps the
// selection, and clicking empty space inside clears the selection. Opening a
// file from the tree keeps that focus; a double click hands it to the editor.

const treeHasFocus = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.activeElement?.closest('.tree-wrapper'))

const editorHasFocus = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.activeElement?.closest('.mu-editor'))

test.describe('Sidebar tree focus scope', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-focus-'))
    fs.writeFileSync(path.join(projectDir, 'alpha.md'), '# Alpha\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'beta.md'), '# Beta\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'gamma.md'), '# Gamma\n', 'utf-8')
    fs.writeFileSync(path.join(projectDir, 'delta.md'), '# Delta\n', 'utf-8')
    fs.mkdirSync(path.join(projectDir, 'notes'))

    const launched = await launchElectron([projectDir], { windowLayout: { showSideBar: true } })
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
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('clicking a row focuses the tree without focusing the editor', async() => {
    const file = page.locator('.side-bar-file[title$="alpha.md"]').first()
    await file.click()

    await expect.poll(() => treeHasFocus(page)).toBe(true)
    await expect.poll(() => editorHasFocus(page)).toBe(false)
    await expect(file).toHaveClass(/active/)
  })

  test('clicking a second file keeps tree focus', async() => {
    const first = page.locator('.side-bar-file[title$="alpha.md"]').first()
    const second = page.locator('.side-bar-file[title$="gamma.md"]').first()

    await first.click()
    await expect.poll(() => treeHasFocus(page)).toBe(true)

    await second.click()
    await expect.poll(() => treeHasFocus(page)).toBe(true)
  })

  test('clicking another file while the editor has focus keeps tree focus', async() => {
    const focused = page.locator('.side-bar-file[title$="beta.md"]').first()
    const target = page.locator('.side-bar-file[title$="delta.md"]').first()

    await focused.dblclick()
    await expect.poll(() => editorHasFocus(page)).toBe(true)

    await target.click()
    await expect.poll(() => treeHasFocus(page)).toBe(true)
    await expect.poll(() => editorHasFocus(page)).toBe(false)
  })

  test('clicking an already open, non-current file keeps tree focus', async() => {
    const first = page.locator('.side-bar-file[title$="alpha.md"]').first()
    const second = page.locator('.side-bar-file[title$="beta.md"]').first()

    await first.click()
    await second.click()
    await expect.poll(() => treeHasFocus(page)).toBe(true)

    await first.click()
    await expect.poll(() => treeHasFocus(page)).toBe(true)
  })

  test('clicking the editor keeps the selection but moves focus out', async() => {
    const file = page.locator('.side-bar-file[title$="alpha.md"]').first()
    await file.click()
    await expect(file).toHaveClass(/active/)

    await page.locator('.mu-editor').first().click()
    await expect.poll(() => treeHasFocus(page)).toBe(false)
    await expect(file).toHaveClass(/active/)
  })

  test('clicking empty space inside the tree clears the selection', async() => {
    const file = page.locator('.side-bar-file[title$="beta.md"]').first()
    await file.click()
    await expect(file).toHaveClass(/active/)

    const tree = page.locator('.tree-wrapper')
    const box = await tree.boundingBox()
    expect(box).not.toBeNull()
    await tree.click({ position: { x: 10, y: Math.max(1, box!.height - 4) } })

    await expect(file).not.toHaveClass(/active/)
    await expect.poll(() => treeHasFocus(page)).toBe(true)
  })

  test('double clicking a file focuses the editor', async() => {
    const file = page.locator('.side-bar-file[title$="beta.md"]').first()
    await file.dblclick()
    await expect.poll(() => editorHasFocus(page)).toBe(true)
  })

  for (const location of ['root', 'nested']) {
    for (const kind of ['file', 'folder']) {
      test(`clicking the new ${kind} input in a ${location} directory preserves caret focus`, async() => {
        const menuPrefix = kind === 'file' ? 'newFileMenuItem' : 'newDirectoryMenuItem'
        await app.evaluate(({ ipcMain }, prefix) => {
          ipcMain.removeAllListeners('mt::menu::popup')
          ipcMain.on('mt::menu::popup', (event, template: Array<{ id?: string }>) => {
            const item = template.find(item => item.id?.startsWith(prefix))
            if (!item?.id) throw new Error('Missing create menu item')
            event.sender.send('mt::menu::click', { id: item.id })
          })
        }, menuPrefix)

        const directory = location === 'root' ? projectDir : path.join(projectDir, 'notes')
        const row = location === 'root'
          ? page.locator('.project-root')
          : page.locator('.folder-name').filter({ hasText: /^notes$/ })
        await row.click({ button: 'right' })
        const input = page.locator('input.new-input:visible')
        await expect(input).toBeFocused()
        await input.fill(`draft-${kind}`)
        await input.click({ position: { x: 8, y: 8 } })
        await expect(input).toBeFocused()
        await page.keyboard.press('End')
        await page.keyboard.type('-edited')
        await expect(input).toHaveValue(`draft-${kind}-edited`)
        await page.keyboard.press('Enter')

        const name = `draft-${kind}-edited${kind === 'file' ? '.md' : ''}`
        await expect.poll(() => fs.existsSync(path.join(directory, name))).toBe(true)
      })
    }
  }
})
