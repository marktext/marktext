import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import { launchWithMarkdown, waitForMenuReady, sendIpcToRenderer } from './helpers'

// #2423 — arrowheads vanished from sequence diagrams in exported PDFs.
//
// PDF export renders the document to HTML and appends it to the *live* editor
// window as `article.print-container`, then prints that window. The editor's
// own copy of the same diagram is still in the DOM, so any id the diagram
// renderer hardcodes exists twice; `url(#id)` binds to the first match in tree
// order — the editor's — which `@media print` has taken out of layout, leaving
// the reference painting nothing.
//
// The invariant is therefore: every `url(#…)` reference inside the print
// container must resolve to an element inside that same container.

const DOC =
  '```sequence\n' +
  'Alice->Bob: Hello Bob, how are you?\n' +
  'Bob-->Alice: I am good thanks!\n' +
  '```\n'

interface ReferenceReport {
  references: string[]
  unresolved: string[]
}

const stubSaveDialog = async(app: ElectronApplication, targetPath: string): Promise<void> => {
  await app.evaluate(async({ dialog }, savePath) => {
    ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async() => ({
      canceled: false,
      filePath: savePath
    })
  }, targetPath)
}

// The print container lives for about a frame, so it has to be observed
// rather than polled for.
const installReferenceProbe = async(page: Page): Promise<void> => {
  await page.evaluate(() => {
    const w = window as unknown as { __mt_svg_refs__?: unknown }
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          const container = node as HTMLElement
          if (container.nodeType !== 1 || !container.classList?.contains('print-container')) {
            continue
          }
          const references = new Set<string>()
          for (const element of Array.from(container.querySelectorAll('*'))) {
            for (const attribute of Array.from(element.attributes)) {
              for (const match of attribute.value.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) {
                references.add(match[1])
              }
            }
          }
          const unresolved = [...references].filter((id) => {
            const target = document.getElementById(id)
            return !target || !container.contains(target)
          })
          w.__mt_svg_refs__ = { references: [...references], unresolved }
        }
      }
    })
    observer.observe(document.body, { childList: true })
  })
}

const pollForFile = async(filePath: string, timeoutMs = 60000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PDF was not written within ${timeoutMs}ms: ${filePath}`)
}

test.describe('sequence diagram arrowheads survive PDF export (#2423)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    test.setTimeout(120000)
    const launched = await launchWithMarkdown(DOC)
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    // The vendored js-sequence-diagrams renderer draws from a font-load
    // callback, so the editor's own copy needs a moment to appear.
    await page.waitForTimeout(5000)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('every url(#…) reference in the print container resolves inside it', async() => {
    test.setTimeout(120000)
    const target = `/tmp/marktext-e2e-2423-${Date.now()}.pdf`
    fs.rmSync(target, { force: true })

    await installReferenceProbe(page)
    await stubSaveDialog(app, target)
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'pdf')
    const confirm = page.locator('.print-settings-dialog .button-primary')
    await confirm.waitFor({ state: 'visible', timeout: 20000 })
    await confirm.click()
    await pollForFile(target)
    fs.rmSync(target, { force: true })

    const report = (await page.evaluate(
      () => (window as unknown as { __mt_svg_refs__?: ReferenceReport }).__mt_svg_refs__
    )) as ReferenceReport | undefined

    expect(report, 'the print container should have been observed').toBeTruthy()
    expect(
      report!.references.length,
      'the sequence diagram should reference its arrowhead markers'
    ).toBeGreaterThan(0)
    expect(report!.unresolved).toEqual([])
  })
})
