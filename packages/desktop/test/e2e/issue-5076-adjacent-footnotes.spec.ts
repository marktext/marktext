import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchWithMarkdown, sendIpcToRenderer, waitForEditor, waitForMenuReady } from './helpers'

// #5076: footnote definitions written one per line — the shape pandoc and
// GFM both emit, and what a .md drafted outside MarkText normally looks
// like — used to nest inside their predecessor instead of standing as
// siblings. Only the first definition became a footnote; the rest were
// swallowed into its body, and saving re-indented them by four spaces per
// nesting level.
//
// The footnote extension is off by default, and flipping it re-parses the
// markdown the current state serialises to — by which point the three
// definitions are already blank-line separated paragraphs, which parse
// correctly either way. So the preference has to be on *before* the file is
// read: open a probe document first, flip the preference, wait for the probe
// to re-render as a footnote, and only then open the document under test.

const PROBE_DOC = 'probe[^a]\n\n[^a]: probe definition\n'
const DOC = 'Body a[^1] b[^2] c[^3].\n\n[^1]: one\n[^2]: two\n[^3]: three\n'

const writeDoc = (content: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2e-5076-'))
  const filePath = path.join(dir, 'adjacent-footnotes.md')
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

test.describe('Adjacent footnote definitions (#5076)', () => {
  let app: ElectronApplication
  let page: Page
  let docPath: string

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(PROBE_DOC)
    app = launched.app
    page = launched.page

    await page.evaluate(() => {
      window.electron.ipcRenderer.send('mt::set-user-preference', { footnote: true })
    })
    // The probe turning into a figure proves the preference reached the
    // renderer before we hand it the document under test.
    await expect.poll(() => page.locator('figure.mu-footnote').count(), {
      timeout: 15000
    }).toBe(1)

    docPath = writeDoc(DOC)
    await app.evaluate(({ BrowserWindow, ipcMain }, target) => {
      const win = BrowserWindow.getAllWindows()[0]
      ipcMain.emit('app-open-file-by-id', win.id, target)
    }, docPath)
    await waitForEditor(page)
    await waitForMenuReady(app)
    await expect.poll(() => page.locator('sup.mu-inline-footnote-identifier').count(), {
      timeout: 15000
    }).toBe(3)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('renders each definition as its own top-level footnote', async() => {
    expect(await page.locator('figure.mu-footnote').count()).toBe(3)
    // Swallowing showed up as a footnote figure inside another one.
    expect(await page.locator('figure.mu-footnote figure.mu-footnote').count()).toBe(0)

    const identifiers = await page.evaluate(() =>
      [...document.querySelectorAll('figure.mu-footnote .mu-footnote-input')].map(
        el => el.textContent
      )
    )
    expect(identifiers).toEqual(['1', '2', '3'])
  })

  test('saves the definitions back at the left margin', async() => {
    await page.click('.editor-component')
    await page.keyboard.type('!')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => fs.readFileSync(docPath, 'utf-8'), { timeout: 15000 }).toContain('!')

    const saved = fs.readFileSync(docPath, 'utf-8')
    expect(saved).toContain('[^1]: one')
    expect(saved).toContain('[^2]: two')
    expect(saved).toContain('[^3]: three')
    // Swallowed definitions were written back one continuation level deeper
    // for each level of nesting.
    expect(saved).not.toMatch(/^ +\[\^/m)
  })
})
