import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import { launchWithMarkdown, waitForMenuReady, sendIpcToRenderer } from './helpers'

const LONG_DOC = Array.from(
  { length: 200 },
  (_, i) =>
    `## Section ${i}\n\nParagraph ${i} with **bold** and *italic* text.\n\n- item a\n- item b\n`
).join('\n')

interface ContainerSample {
  bodyScrollHeight: number
  bodyClientHeight: number
}

const installContainerProbe = async(page: Page): Promise<void> => {
  await page.evaluate(() => {
    const w = window as unknown as { __mt_container_samples__?: ContainerSample[] }
    const samples: ContainerSample[] = []
    w.__mt_container_samples__ = samples
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue
          if (!node.classList.contains('mu-render-container')) continue
          samples.push({
            bodyScrollHeight: document.body.scrollHeight,
            bodyClientHeight: document.body.clientHeight
          })
        }
      }
    })
    observer.observe(document.body, { childList: true })
  })
}

const readContainerSamples = async(page: Page): Promise<ContainerSample[]> =>
  await page.evaluate(() => {
    const w = window as unknown as { __mt_container_samples__?: ContainerSample[] }
    return (w.__mt_container_samples__ ?? []).slice()
  })

const stubSaveDialog = async(app: ElectronApplication, targetPath: string): Promise<void> => {
  await app.evaluate(async({ dialog }, savePath) => {
    ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async() => ({
      canceled: false,
      filePath: savePath
    })
  }, targetPath)
}

const waitForFile = async(filePath: string, timeoutMs = 30000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PDF was not written within ${timeoutMs}ms: ${filePath}`)
}

test.describe('#5541: the export render container stays out of the page layout', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(LONG_DOC)
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('exporting does not grow the host document', async() => {
    const out = '/tmp/marktext-e2e-5541-' + Date.now() + '.pdf'
    await stubSaveDialog(app, out)
    await installContainerProbe(page)

    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'pdf')
    const confirm = page.locator('.print-settings-dialog .button-primary')
    await confirm.waitFor({ state: 'visible', timeout: 10000 })
    await confirm.click()

    await waitForFile(out)
    fs.rmSync(out, { force: true })

    const samples = await readContainerSamples(page)
    expect(samples, 'the export container should have been observed').not.toHaveLength(0)
    for (const sample of samples) {
      expect(sample.bodyScrollHeight).toBeLessThanOrEqual(sample.bodyClientHeight)
    }
  })
})
