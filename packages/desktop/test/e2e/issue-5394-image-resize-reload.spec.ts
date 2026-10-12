import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  launchElectron,
  waitForEditor,
  waitForMenuReady,
  expectNoRendererErrors,
  getMarkdownContent
} from './helpers'

const original = '# Title\n\nSome text before the image.\n\n![](pic.svg)\n\nText after the image.\n'
const changed = original.replace('Some text before the image.', 'Changed on disk.')

for (const scenario of ['reload-auto-save', 'reload-no-auto-save', 'undo'] as const) {
  test(`5394: cancels image resize during ${scenario}`, async() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-5394-'))
    const filePath = path.join(dir, 'doc.md')
    fs.writeFileSync(filePath, original)
    fs.writeFileSync(
      path.join(dir, 'pic.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="blue"/></svg>'
    )
    const { app, page } = await launchElectron([filePath], {
      suppressErrorDialog: true,
      preferences: {
        autoSave: scenario !== 'reload-no-auto-save',
        autoSaveDelay: 1000,
        language: 'en'
      }
    })
    try {
      await waitForEditor(page)
      await waitForMenuReady(app)
      const image = page.locator('.editor-component .mu-image-container img')
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(400)

      if (scenario === 'undo') {
        fs.writeFileSync(filePath, changed)
        await expect(page.locator('.editor-component')).toContainText('Changed on disk.')
      }

      const startDrag = async() => {
        await image.click()
        const handle = page.locator('.mu-transformer .right')
        await expect(handle).toBeVisible()
        const box = await handle.boundingBox()
        if (!box) throw new Error('Resize handle has no bounding box')
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x - 40, y)
        return { x, y }
      }
      const { x, y } = await startDrag()
      await expect(image).toHaveAttribute('width', '360')

      if (scenario === 'undo') {
        await app.evaluate(({ Menu, BrowserWindow }) => {
          const undo = Menu.getApplicationMenu()
            ?.items.flatMap((item) => item.submenu?.items ?? [])
            .find((item) => item.label === 'Undo')
          if (!undo) throw new Error('Undo menu item not found')
          const win = BrowserWindow.getAllWindows()[0]
          undo.click(undefined, win, win.webContents)
        })
      } else {
        // Writing the file exercises the real watcher while the mouse stays held.
        fs.writeFileSync(filePath, changed)
      }
      const expectedText = scenario === 'undo' ? 'Some text before the image.' : 'Changed on disk.'
      await expect(page.locator('.editor-component')).toContainText(expectedText)
      await expect(page.locator('.mu-transformer .bar')).toHaveCount(0)
      await page.mouse.move(x - 50, y)
      await page.mouse.up()
      await expect.poll(() => image.evaluate((img) => img.getBoundingClientRect().width)).toBe(400)
      await expectNoRendererErrors(app)
      await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain(expectedText)
      expect(fs.readFileSync(filePath, 'utf8')).not.toContain('width=')
      expect(await getMarkdownContent(page, app)).not.toContain('width=')

      await startDrag()
      await page.mouse.up()
      await expect.poll(() => getMarkdownContent(page, app)).toContain('width="360"')
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}
