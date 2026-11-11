import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  expectNoRendererErrors,
  launchWithMarkdown,
  openProjectFolder,
  placeCaretInEditor,
  setSourceMarkdown
} from './helpers'

test.describe('File icons in the built application', () => {
  let app: ElectronApplication
  let page: Page
  let directory: string
  const names = ['notes.md', 'Dockerfile-Notes.md', 'notes.markdown', 'notes.mdown', 'notes.mkd']

  test.beforeAll(async() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-file-icons-'))
    for (const name of names) fs.writeFileSync(path.join(directory, name), '# Icon verification\n')
    const launched = await launchWithMarkdown('\n', {
      windowLayout: { showSideBar: true },
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await openProjectFolder(app, page, directory, path.join(directory, names[0]))
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (directory) fs.rmSync(directory, { recursive: true, force: true })
  })

  test('renders markdown sidebar glyphs and loads all five bundled icon fonts', async() => {
    for (const name of names) {
      const icon = page.locator('.tree-wrapper')
        .getByTitle(path.join(directory, name), { exact: true })
        .locator('.file-icon')
      await expect(icon).toBeVisible()
      await expect(icon).toHaveClass(/\bmarkdown-icon\b/)
      const glyph = await icon.evaluate(element => getComputedStyle(element, '::before').content)
      expect(glyph).not.toBe('none')
      expect(glyph).not.toBe('""')
    }

    const fonts = await page.evaluate(async() => {
      const families = ['FontAwesome', 'Mfizz', 'Devicons', 'Octicons Regular', 'file-icons']
      return Promise.all(families.map(async family => {
        const faces = await document.fonts.load(`16px "${family}"`)
        return { family, loaded: faces.length > 0 && faces.every(face => face.status === 'loaded') }
      }))
    })
    expect(fonts.filter(font => !font.loaded)).toEqual([])
    await expectNoRendererErrors(app)
  })

  test('renders language picker icons and applies the selected code language', async() => {
    await setSourceMarkdown(page, app, '\n')
    await placeCaretInEditor(page)
    await page.keyboard.type('```javascript', { delay: 30 })
    const item = page.locator('.mu-list-picker li[data-label="javascript"]')
    await expect(item).toBeVisible()
    const icon = item.locator('.icon-wrapper span')
    await expect(icon).toBeVisible()
    await expect(icon).toHaveClass(/\b(?:js|javascript)-icon\b/)
    const glyph = await icon.evaluate(element => getComputedStyle(element, '::before').content)
    expect(glyph).not.toBe('none')
    expect(glyph).not.toBe('""')
    await item.click()
    await expect(page.locator('.mu-code-block .mu-language-input')).toHaveText('javascript')
    await expectNoRendererErrors(app)
  })
})
