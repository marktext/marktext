import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expectNoRendererErrors, launchWithMarkdown, setSourceMarkdown } from './helpers'

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

test.describe('image preview copying', () => {
  let app: ElectronApplication
  let page: Page
  let fixture: string
  let imagePath: string
  let server: Server
  let serverUrl: string

  const openPreview = async() => {
    await page.locator('.editor-component .mu-image-success img').click()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeEnabled()
  }

  const copyPreview = async() => {
    await page.getByRole('button', { name: 'Copy image', exact: true }).click()
    await expect(page.locator('.media-viewer-toolbar button.is-done')).toBeVisible()
  }

  test.beforeAll(async() => {
    fixture = mkdtempSync(join(tmpdir(), 'marktext-preview-copy-'))
    imagePath = join(fixture, 'source.png')
    copyFileSync(resolve('static/logo-96px.png'), imagePath)
    server = createServer((req, res) => {
      if (req.url === '/generic.png' || req.url === '/untyped.png') {
        if (req.url === '/generic.png') res.setHeader('Content-Type', 'application/octet-stream')
        res.end(readFileSync(imagePath))
        return
      }
      if (req.url === '/redirect.svg') {
        res.writeHead(302, { Location: '/image.svg' })
        res.end()
        return
      }
      res.setHeader('Content-Type', 'image/svg+xml')
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="60" height="40" fill="red"/></svg>')
    })
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Image server did not start')
    serverUrl = `http://127.0.0.1:${address.port}`
    const launched = await launchWithMarkdown('target\n', {
      suppressErrorDialog: true,
      preferences: { language: 'en', autoSave: false, imageInsertAction: 'folder', imagePreferRelativeDirectory: true }
    })
    app = launched.app
    page = launched.page
    await app.evaluate(({ clipboard }) => {
      const state = globalThis as typeof globalThis & { previewClipboardBackup?: Array<[string, Uint8Array]> }
      state.previewClipboardBackup = clipboard.availableFormats().map(format => [format, clipboard.readBuffer(format)])
    })
  })

  test.beforeEach(async() => {
    await setSourceMarkdown(page, app, `<img src="${imagePath}" alt="sample" width="48" height="48">\n\ntarget\n`)
    await app.evaluate(({ clipboard }) => clipboard.clear())
  })

  test.afterEach(async() => {
    await expectNoRendererErrors(app)
  })

  test.afterAll(async() => {
    if (app) {
      await app.evaluate(({ clipboard }) => {
        const state = globalThis as typeof globalThis & { previewClipboardBackup?: Array<[string, Uint8Array]> }
        clipboard.clear()
        for (const [format, bytes] of state.previewClipboardBackup ?? []) clipboard.writeBuffer(format, Buffer.from(bytes))
      })
      await app.close()
    }
    if (server) await new Promise<void>(done => server.close(() => done()))
    if (fixture) rmSync(fixture, { recursive: true, force: true })
  })

  test('copies the natural-size bitmap and pastes it as a new external image', async() => {
    await openPreview()
    await copyPreview()
    expect(await app.evaluate(({ clipboard }) => ({ text: clipboard.readText(), size: clipboard.readImage().getSize() })))
      .toEqual({ text: '', size: { width: 96, height: 96 } })
    await page.keyboard.press('Escape')
    await page.locator('.mu-paragraph-content').filter({ hasText: 'target' }).click()
    await page.keyboard.press(`${modifier}+v`)
    await expect(page.locator('.editor-component .mu-image-container img')).toHaveCount(2)
  })

  for (const source of ['generic.png', 'untyped.png']) {
    test(`copies a displayable remote PNG served as ${source}`, async() => {
      await setSourceMarkdown(page, app, `![remote](${serverUrl}/${source})\n`)
      await openPreview()
      await copyPreview()
      expect(await app.evaluate(({ clipboard }) => clipboard.readImage().getSize())).toEqual({ width: 96, height: 96 })
      await page.keyboard.press('Escape')
    })
  }

  test('copies a remote SVG through redirects and preserves transparency', async() => {
    await setSourceMarkdown(page, app, `![remote](${serverUrl}/redirect.svg)\n`)
    await openPreview()
    await copyPreview()
    const copied = await app.evaluate(({ clipboard }) => {
      const image = clipboard.readImage()
      const bitmap = image.toBitmap()
      return { size: image.getSize(), firstAlpha: bitmap[3], lastAlpha: bitmap[bitmap.length - 1] }
    })
    expect(copied).toEqual({ size: { width: 120, height: 80 }, firstAlpha: 255, lastAlpha: 0 })
    await page.keyboard.press('Escape')
  })
})
