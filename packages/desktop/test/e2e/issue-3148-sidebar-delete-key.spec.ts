import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #3148 — a file selected in the sidebar should move to the trash on Delete,
// after a native confirmation. The native dialog is stubbed in the main
// process: a real `showMessageBox` would block the headless run, and a real
// `shell.trashItem` would delete repository files.

type TrashGlobals = {
  __mt_trash_dialogs__?: Array<Record<string, unknown>>
  __mt_trash_count__?: number
  __mt_trash_response__?: number
}

const trashDialogs = (app: ElectronApplication) =>
  app.evaluate(
    () => (global as unknown as TrashGlobals).__mt_trash_dialogs__ ?? []
  )

const trashCount = (app: ElectronApplication) =>
  app.evaluate(() => (global as unknown as TrashGlobals).__mt_trash_count__ ?? 0)

test.describe('Sidebar Delete key (#3148)', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-3148-'))
    fs.writeFileSync(path.join(projectDir, 'note.md'), '# Note\n', 'utf-8')

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

    await app.evaluate(({ dialog, shell }) => {
      const g = global as unknown as TrashGlobals
      g.__mt_trash_dialogs__ = []
      g.__mt_trash_count__ = 0
      g.__mt_trash_response__ = 1
      const dialogs = g.__mt_trash_dialogs__
      const trashCount = () => (g.__mt_trash_count__ = (g.__mt_trash_count__ ?? 0) + 1)
      ;(dialog as { showMessageBox: unknown }).showMessageBox = async(...args: unknown[]) => {
        const options = (args.length > 1 ? args[1] : args[0]) as Record<string, unknown>
        dialogs.push(options)
        return { response: g.__mt_trash_response__, checkboxChecked: false }
      }
      ;(shell as { trashItem: unknown }).trashItem = async() => trashCount()
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test('Delete trashes only after the confirmation is accepted', async() => {
    const file = page.locator('.side-bar-file[title$=".md"]').first()
    const pathname = await file.getAttribute('title')
    expect(pathname).toBeTruthy()

    await file.click()

    // Clicking a markdown file opens it and the editor takes focus; the
    // shortcut must still reach the sidebar selection.
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.mu-editor'))).toBe(
      true
    )

    // macOS fires a `Meta` keydown the moment Cmd goes down — before the
    // chord's second key. It must not end the selection.
    await page.keyboard.press('Meta')
    await expect(file).toHaveClass(/active/)

    await page.keyboard.press('Delete')
    await expect.poll(() => trashDialogs(app)).toHaveLength(1)
    expect(await trashCount(app)).toBe(0)

    // The selection only survives clicks that land on a row: tree chrome such
    // as the project title ends it instead of leaving a stale target behind.
    await file.click()
    await expect(file).toHaveClass(/active/)
    await page.locator('.project-tree > .title').dispatchEvent('click')
    await expect(file).not.toHaveClass(/active/)

    // Same selection, but now the dialog confirms.
    await app.evaluate(() => {
      ;(global as unknown as TrashGlobals).__mt_trash_response__ = 0
    })
    await file.click()
    await page.keyboard.press('Delete')

    await expect.poll(() => trashCount(app)).toBe(1)
    const dialogs = await trashDialogs(app)
    expect(String(dialogs[dialogs.length - 1]?.message)).toContain(String(pathname).split('/').pop())
  })
})
