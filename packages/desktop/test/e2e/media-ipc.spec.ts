import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchElectron } from './helpers'
import { backupClipboard, restoreClipboard } from './clipboardHelpers'

test.describe('media IPC bridge', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the save dialog, clipboard image and PlantUML fetch reach the renderer', async() => {
    expect(await page.evaluate(() => typeof window.electron?.dialog?.showSave)).toBe('function')
    expect(await page.evaluate(() => typeof window.electron?.clipboard?.writeImage)).toBe(
      'function'
    )
    expect(await page.evaluate(() => typeof window.diagram?.fetchPlantuml)).toBe('function')
  })

  test('main refuses a PlantUML request it did not compose', async() => {
    const refusals = await page.evaluate(async() => {
      const bad = [
        ['file:///etc', 'AAAA'],
        ['https://user:pass@evil.test', 'AAAA'],
        ['https://example.test', '../../etc/passwd']
      ] as const

      return Promise.all(
        bad.map(([server, encoded]) => window.diagram.fetchPlantuml(server, encoded, 'svg'))
      )
    })

    for (const result of refusals) {
      // Refused outright, not attempted and failed: a network error would
      // satisfy `ok: false` just as well and mean the opposite.
      expect(result).toEqual({ ok: false, error: 'Invalid PlantUML request' })
    }
  })

  test('main refuses a well-formed host the user never configured', async() => {
    const refusals = await page.evaluate(async() => {
      // Each of these passes every shape check: https or http, no credentials,
      // no query, a valid PlantUML encoding. Only their identity is wrong.
      const elsewhere = [
        'http://127.0.0.1:8080/plantuml',
        'http://169.254.169.254/latest/meta-data',
        'https://www.plantuml.com.evil.test/plantuml'
      ]

      return Promise.all(
        elsewhere.map((server) =>
          window.diagram.fetchPlantuml(server, 'SyfFKj2rKt3CoKnELR1Io4ZDoSa70000', 'svg')
        )
      )
    })

    for (const result of refusals) {
      expect(result).toEqual({ ok: false, error: 'Invalid PlantUML request' })
    }
  })

  test('a PNG round-trips through the clipboard', async() => {
    // 1x1 transparent PNG.
    const written = await page.evaluate(async() => {
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return window.electron.clipboard.writeImage(bytes)
    })

    expect(written).toBe(true)
    expect(await app.evaluate(({ clipboard }) => clipboard.has('image/png'))).toBe(true)
  })

  test('Unicode text round-trips through the clipboard bridge', async() => {
    const text = 'MarkText 剪贴板 📝'
    expect(await page.evaluate((value) => window.electron.clipboard.writeText(value), text)).toBe(
      true
    )
    expect(await page.evaluate(() => window.electron.clipboard.readText())).toBe(text)
  })

  test('an empty clipboard can be backed up and restored', async() => {
    await app.evaluate(({ clipboard }) => clipboard.clear())
    await backupClipboard(app)
    await restoreClipboard(app)
    expect(await page.evaluate(() => window.electron.clipboard.readText())).toBe('')
  })

  test('native copied files retain Unicode, spaces and URL characters', async() => {
    const dir = mkdtempSync(join(tmpdir(), 'marktext-clipboard-'))
    const file = join(dir, '图片 #1.png')
    writeFileSync(file, '')
    try {
      await app.evaluate(
        ({ clipboard, ClipboardItem }, uri) =>
          clipboard.write([new ClipboardItem({ 'text/uri-list': uri })]),
        pathToFileURL(file).href
      )
      expect(await page.evaluate(() => window.electron.clipboard.guessFilePath())).toBe(file)
    } finally {
      await app.evaluate(({ clipboard }) => clipboard.clear())
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
