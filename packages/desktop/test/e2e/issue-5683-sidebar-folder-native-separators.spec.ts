import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #5683 — renaming or deleting a folder left its sidebar row behind on Windows.
// The main-process watcher reports paths with OS-native separators (`\`), while
// the sandboxed renderer's `pathe` shim stored the folder node with `/`, so the
// tree's `pathname ===` lookup missed. A posix e2e host can't produce a real
// Windows rename, so inject the native-separator `unlinkDir` the watcher would
// send and assert the row disappears.
test.describe('Sidebar folder tree with native-separator watcher events (#5683)', () => {
  let app: ElectronApplication
  let page: Page
  let projectDir: string

  test.beforeAll(async() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-5683-'))
    fs.mkdirSync(path.join(projectDir, 'pkg'))
    fs.writeFileSync(path.join(projectDir, 'pkg', 'a.md'), '# a\n', 'utf-8')

    const launched = await launchElectron([projectDir])
    app = launched.app
    page = launched.page
    // Opening a directory can attach to a window other than the first one.
    await expect
      .poll(
        async() => {
          for (const candidate of app.windows()) {
            const titles = await candidate
              .locator('.side-bar-folder .folder-name')
              .evaluateAll((els) => els.map((el) => el.getAttribute('title')))
            if (titles.some((title) => title && title.endsWith('/pkg'))) {
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

  test('removes the folder row when the watcher unlinkDir uses native separators', async() => {
    const folderRow = '.side-bar-folder .folder-name[title$="/pkg"]'
    await expect(page.locator(folderRow)).toHaveCount(1)

    const nativePkgPath = path.join(projectDir, 'pkg').replace(/\//g, '\\')
    await app.evaluate(({ BrowserWindow }, pkgPath) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('mt::update-object-tree', {
          type: 'unlinkDir',
          change: { pathname: pkgPath }
        })
      }
    }, nativePkgPath)

    await expect(page.locator(folderRow)).toHaveCount(0)
  })
})
