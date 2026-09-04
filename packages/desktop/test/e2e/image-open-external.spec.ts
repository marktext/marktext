import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchElectron,
  waitForEditor,
  waitForMenuReady,
  expectNoRendererErrors
} from './helpers'

// #2461 — right-clicking an image produced no menu at all: the editor context
// menu required `isEditable`, and muya renders inline images
// `contenteditable="false"` (inlineRenderer/renderer/image.ts), so Electron
// reports `isEditable: false` for them. The image branch therefore gates on
// `hasImageContents` instead, and offers the one action with a system
// counterpart — hand the file to the OS's associated image viewer.
//
// `Menu.popup` and `shell.openPath` are stubbed in the main process: popping a
// real OS menu would take focus from the renderer, and really opening the file
// would launch the platform's image viewer under CI. The raw Menu instances are
// kept on a main-process global so the item's real click handler can be invoked
// there — MenuItem objects cannot cross the CDP boundary.

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">' +
  '<rect width="120" height="80" fill="#33aa77"/></svg>'
const DATA_URI = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`

type MenuSummary = Array<{ id?: string, label?: string }>

test.describe('Open Image in the associated viewer (#2461)', () => {
  let app: ElectronApplication
  let page: Page
  let dir: string
  let imagePath: string

  test.beforeAll(async() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-open-image-e2e-'))
    imagePath = path.join(dir, 'photo.svg')
    fs.writeFileSync(imagePath, SVG, 'utf8')
    const md = path.join(dir, 'note.md')
    fs.writeFileSync(md, `# open external\n\n![local](./photo.svg)\n\n![inline](${DATA_URI})\n`, 'utf8')

    const launched = await launchElectron([md], { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await waitForMenuReady(app)

    await app.evaluate(({ Menu, shell }) => {
      const g = globalThis as unknown as {
        __menus: Electron.Menu[]
        __opened: string[]
        __openPathPatched: boolean
      }
      g.__menus = []
      g.__opened = []
      Menu.prototype.popup = function(this: Electron.Menu) {
        g.__menus.push(this)
      }
      shell.openPath = async(target: string) => {
        g.__opened.push(target)
        return ''
      }
      g.__openPathPatched = true
    })

    await page.waitForSelector('.editor-component .mu-inline-image.mu-image-success img', {
      state: 'attached',
      timeout: 20000
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const menuSummary = (): Promise<MenuSummary[]> =>
    app.evaluate(() => {
      const g = globalThis as unknown as { __menus: Electron.Menu[] }
      return g.__menus.map((m) => m.items.map((i) => ({ id: i.id, label: i.label })))
    })

  const clickLastMenuItem = (): Promise<void> =>
    app.evaluate(({ BrowserWindow }) => {
      const g = globalThis as unknown as { __menus: Electron.Menu[] }
      const menu = g.__menus[g.__menus.length - 1]
      const win = BrowserWindow.getAllWindows()[0]
      const item = menu.items[0]
      item.click(undefined, win, win.webContents)
    })

  const openedPaths = (): Promise<string[]> =>
    app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened)

  const rightClickImage = async(index: number) => {
    const img = page
      .locator('.editor-component .mu-inline-image .mu-image-container img')
      .nth(index)
    await img.waitFor({ state: 'attached', timeout: 15000 })
    await img.click({ button: 'right', timeout: 8000 })
    await page.waitForTimeout(500)
  }

  test('the stubs are in place before asserting on them', async() => {
    const patched = await app.evaluate(
      () => (globalThis as unknown as { __openPathPatched?: boolean }).__openPathPatched === true
    )
    expect(patched).toBe(true)
  })

  test('right-clicking a local image offers "Open Image" and opens that file', async() => {
    const before = (await menuSummary()).length
    const openedBefore = (await openedPaths()).length
    await rightClickImage(0)

    const menus = await menuSummary()
    expect(menus.length).toBe(before + 1)
    const items = menus[menus.length - 1]
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('openImageMenuItem')
    // The label must be a resolved translation. `getTranslation` returns the key
    // itself when the locale file cannot be loaded, so a bare truthiness check
    // would pass while the user is shown a raw "contextMenu.openImage".
    expect(items[0].label).toBeTruthy()
    expect(items[0].label).not.toContain('contextMenu.')
    // Building the menu must not open anything yet.
    expect((await openedPaths()).length).toBe(openedBefore)

    await clickLastMenuItem()
    // The engine renders `photo.svg?mucache=mu-N`; the query must be gone by the
    // time the path reaches the OS, or the open fails.
    const opened = await openedPaths()
    expect(opened.slice(openedBefore)).toEqual([imagePath])

    await expectNoRendererErrors(app)
  })

  test('right-clicking a data: image stays menuless, as it has no file to open', async() => {
    const before = (await menuSummary()).length
    const openedBefore = (await openedPaths()).length
    await rightClickImage(1)

    expect((await menuSummary()).length).toBe(before)
    expect((await openedPaths()).length).toBe(openedBefore)

    await expectNoRendererErrors(app)
  })
})
