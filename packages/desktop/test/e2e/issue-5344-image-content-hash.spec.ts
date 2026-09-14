import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  clickMenuById,
  getMarkdownContent,
  launchWithMarkdown,
  placeCaretInEditor,
  setSourceMarkdown
} from './helpers'

// A copied image is named after a hash of its bytes, so re-inserting a source
// path whose file has since changed must produce a second asset instead of
// overwriting the first one that other documents may still reference.

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
// Decoders ignore bytes after IEND, so this is still a valid PNG with a
// different hash.
const CHANGED_PNG = Buffer.concat([PNG, Buffer.from('changed')])

const srcInput = '.mu-image-selector input.src'
const COPIED_IMAGE_LINK = /!\[\]\((assets\/[0-9a-f]{40}\.png)\)/

const insertImageFromPath = async(
  page: Page,
  app: ElectronApplication,
  imagePath: string
): Promise<string> => {
  await placeCaretInEditor(page)
  await clickMenuById(app, 'imageMenuItem')
  await page.waitForSelector(srcInput, { state: 'visible', timeout: 5000 })
  await page.fill(srcInput, imagePath)
  await page.press(srcInput, 'Enter')
  let link = ''
  await expect
    .poll(
      async() => {
        link = (await getMarkdownContent(page, app)).match(COPIED_IMAGE_LINK)?.[1] ?? ''
        return link
      },
      { timeout: 10000 }
    )
    .not.toBe('')
  return link
}

test.describe('Copy image to the relative assets folder', () => {
  let app: ElectronApplication
  let page: Page
  let docDir: string
  let sourceDir: string

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('first\n')
    app = launched.app
    page = launched.page
    docDir = path.dirname(launched.filePath)
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2e-image-src-'))
    await page.evaluate((payload) => {
      window.electron.ipcRenderer.send('mt::set-user-preference', payload)
    }, { imageInsertAction: 'folder', imagePreferRelativeDirectory: true })
    await page.waitForTimeout(500)
  })

  test.afterAll(async() => {
    if (app) await app.close()
    fs.rmSync(sourceDir, { recursive: true, force: true })
  })

  test('keeps the earlier asset when the same source path is re-inserted with new content', async() => {
    const source = path.join(sourceDir, 'shot.png')

    fs.writeFileSync(source, PNG)
    const firstLink = await insertImageFromPath(page, app, source)
    expect(fs.readFileSync(path.join(docDir, firstLink))).toEqual(PNG)

    fs.writeFileSync(source, CHANGED_PNG)
    await setSourceMarkdown(page, app, 'second\n')
    const secondLink = await insertImageFromPath(page, app, source)

    expect(secondLink).not.toBe(firstLink)
    expect(fs.readFileSync(path.join(docDir, firstLink))).toEqual(PNG)
    expect(fs.readFileSync(path.join(docDir, secondLink))).toEqual(CHANGED_PNG)
  })
})
