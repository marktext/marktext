import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import type { WebPreferences } from 'electron'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchElectron, waitForEditor, waitForMenuReady, sendIpcToRenderer } from './helpers'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="red"/></svg>'
let app: ElectronApplication
let page: Page
let server: Server
let directory: string
let origin: string

test.beforeAll(async() => {
  server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'image/svg+xml')
    response.end(svg)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server port')
  origin = `http://127.0.0.1:${address.port}`
  directory = mkdtempSync(join(tmpdir(), 'marktext-security-中文 空格-'))
  writeFileSync(join(directory, '图片.svg'), svg)
  const document = join(directory, 'note.md')
  writeFileSync(document, [
    '# Web security regression',
    '![relative](图片.svg)',
    `![absolute](${pathToFileURL(join(directory, '图片.svg')).href})`,
    `![remote](${origin}/image.svg)`,
    '```plantuml\nAlice -> Bob: hello\n```'
  ].join('\n\n'))
  const launched = await launchElectron([document], {
    preferences: { language: 'en', sideBarVisibility: true, plantumlServer: origin }
  })
  app = launched.app
  page = launched.page
  await waitForEditor(page)
  await waitForMenuReady(app)
})

test.afterAll(async() => {
  if (app) await app.close()
  if (server) {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
  if (directory) rmSync(directory, { recursive: true, force: true })
})

test('release editor and preferences enforce web security', async() => {
  expect(new URL(page.url()).protocol).toBe('file:')
  const opened = app.waitForEvent('window')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const preferences = await opened
  try {
    await preferences.waitForSelector('.pref-sidebar .category')
    const options = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map(win => {
        const contents = win.webContents as typeof win.webContents & {
          getLastWebPreferences: () => WebPreferences
        }
        const prefs = contents.getLastWebPreferences()
        return { webSecurity: prefs.webSecurity, insecureContent: prefs.allowRunningInsecureContent }
      })
    )
    expect(options).toHaveLength(2)
    for (const prefs of options) {
      expect(prefs.webSecurity).toBe(true)
      expect(prefs.insecureContent).toBe(false)
    }
  } finally {
    await app.evaluate(({ BrowserWindow }, url) => {
      BrowserWindow.getAllWindows().find(win => win.webContents.getURL() === url)?.close()
    }, preferences.url())
  }
})

test('local paths and remote images display without CORS headers', async() => {
  const images = page.locator('.editor-component .mu-image-container img')
  await expect(images).toHaveCount(3)
  for (const image of await images.all()) {
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(80)
  }
  await page.screenshot({ path: test.info().outputPath('release-images.png') })
})

test('PlantUML preview and native export fetch work without CORS headers', async() => {
  const image = page.locator('.editor-component .mu-diagram-preview img')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(80)
  const result = await page.evaluate(async(server) => {
    const image = document.querySelector('.mu-diagram-preview img') as HTMLImageElement
    const encoded = new URL(image.src).pathname.split('/').pop() ?? ''
    const result = await window.diagram.fetchPlantuml(server, encoded, 'svg')
    return result.ok ? { ok: true, text: new TextDecoder().decode(result.data) } : result
  }, origin)
  expect(result).toEqual({ ok: true, text: svg })
})

for (const type of ['styledHtml', 'pdf'] as const) {
  test(`exports the image document as ${type}`, async() => {
    const target = join(directory, type === 'pdf' ? 'export.pdf' : 'export.html')
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath })
    }, target)
    await sendIpcToRenderer(app, 'mt::show-export-dialog', type)
    await page.locator('.print-settings-dialog .button-primary').click()
    await expect.poll(() => existsSync(target) ? readFileSync(target).length : 0, {
      timeout: 20000
    }).toBeGreaterThan(0)
    const contents = readFileSync(target)
    if (type === 'pdf') expect(contents.subarray(0, 5).toString()).toBe('%PDF-')
    else expect(contents.toString()).toContain('<img')
  })
}
