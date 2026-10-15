import { createServer, type Server } from 'node:http'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { getMarkdownContent, launchWithMarkdown, placeCaretInEditor } from './helpers'

let app: ElectronApplication
let page: Page
let server: Server
let url: string
let requests: string[]

test.beforeAll(async() => {
  requests = []
  server = createServer((request, response) => {
    requests.push(request.url ?? '')
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<!doctype html><title>Example &amp; page title</title><p>Content</p>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server port')
  url = `http://127.0.0.1:${address.port}`
})

test.beforeEach(async() => {
  const launched = await launchWithMarkdown('\n')
  app = launched.app
  page = launched.page
  await placeCaretInEditor(page)
  requests.length = 0
})

test.afterEach(async() => {
  if (app) await app.close()
})

test.afterAll(async() => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const paste = async(text: string) => {
  await page.evaluate((text) => {
    const target = document.querySelector('.mu-editor[contenteditable="true"]')
    if (!target) throw new Error('Missing editor')
    const data = new DataTransfer()
    data.setData('text/plain', text)
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test('pasted URL gets its title despite renderer CSP and absent CORS headers', async() => {
  expect(await page.evaluate(async(url) => {
    try { await fetch(url); return true } catch { return false }
  }, url)).toBe(false)
  expect(requests).toEqual([])

  await paste(url)
  await expect(page.locator('.editor-component .mu-link').filter({ hasText: 'Example & page title' })).toHaveCount(1)
  expect(requests).toEqual(['/'])
  await page.screenshot({ path: test.info().outputPath('paste-url-title.png') })
  expect(await getMarkdownContent(page, app)).toContain(`[Example & page title](${url})`)
})

test('plain-text paste does not fetch a page title', async() => {
  await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), url)
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('mt::cm-paste-as-plain-text')
  })
  await expect(page.locator('.editor-component')).toContainText(url)
  expect(requests).toEqual([])
  expect(await getMarkdownContent(page, app)).not.toContain('Example & page title')
})

test('failed title lookup preserves the URL', async() => {
  await paste('http://127.0.0.1:1/unreachable')
  await expect(page.locator('.editor-component')).toContainText('http://127.0.0.1:1/unreachable')
})
