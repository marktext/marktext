import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import {
  launchWithMarkdown,
  getMarkdownContent,
  sendIpcToRenderer,
  enterSourceMode,
  exitSourceMode
} from './helpers'

const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
const markdown = types.map(type => `> [!${type}]\n> ${type} body with **bold** text.`).join('\n\n') +
  Array.from({ length: 24 }, (_, i) => `\n>\n> Long caution paragraph ${i + 1}: content must remain readable across page boundaries without clipping or losing the alert title.`).join('')

const exportToFile = async(app: ElectronApplication, page: Page, type: 'styledHtml' | 'pdf', file: string) => {
  if (fs.existsSync(file)) fs.unlinkSync(file)
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async() => ({ canceled: false, filePath })
  }, file)
  await sendIpcToRenderer(app, 'mt::show-export-dialog', type)
  await page.locator('.print-settings-dialog .button-primary').click()
  await expect.poll(() => fs.existsSync(file) ? fs.statSync(file).size : 0, { timeout: 20000 }).toBeGreaterThan(0)
}

test('GitHub Alerts live preference, source round trip and native exports', async() => {
  test.setTimeout(90000)
  const { app, page } = await launchWithMarkdown(markdown, { preferences: { githubAlerts: true } })
  const htmlPath = '/tmp/marktext-alerts-export.html'
  const pdfPath = '/tmp/marktext-alerts-export.pdf'
  for (const file of [htmlPath, pdfPath]) {
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  try {
    await expect(page.locator('.mu-github-alert')).toHaveCount(5)
    const original = await getMarkdownContent(page, app)
    await page.screenshot({ path: '/tmp/marktext-alerts-light.png' })
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::set-user-preference', { theme: 'dark' }))
    await expect(page.locator('body')).toHaveClass(/dark/)
    await page.screenshot({ path: '/tmp/marktext-alerts-dark.png' })
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::set-user-preference', { githubAlerts: false }))
    await expect(page.locator('.mu-github-alert')).toHaveCount(0)
    expect(await getMarkdownContent(page, app)).toBe(original)
    await exportToFile(app, page, 'styledHtml', htmlPath)
    const plainQuoteHtml = fs.readFileSync(htmlPath, 'utf8')
    const count = await page.evaluate(html => new DOMParser().parseFromString(html, 'text/html').querySelectorAll('div.markdown-alert').length, plainQuoteHtml)
    expect(count).toBe(0)
    expect(plainQuoteHtml).toContain('[!NOTE]')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::set-user-preference', { githubAlerts: true }))
    await expect(page.locator('.mu-github-alert')).toHaveCount(5)
    await enterSourceMode(page, app)
    await exitSourceMode(page, app)
    await expect(page.locator('.mu-github-alert')).toHaveCount(5)
    expect(await getMarkdownContent(page, app)).toBe(original)
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = document.querySelector('.source-code .CodeMirror') as Element & {
        CodeMirror: { getValue(): string; setValue(value: string): void }
      }
      cm.CodeMirror.setValue(cm.CodeMirror.getValue().replace('NOTE body', 'NOTE latest body'))
    })
    await exportToFile(app, page, 'styledHtml', htmlPath)
    const html = fs.readFileSync(htmlPath, 'utf8')
    expect(html.includes('NOTE latest body')).toBe(true)
    await exitSourceMode(page, app)
    for (const type of types) expect(html).toContain(`markdown-alert-${type.toLowerCase()}`)
    expect(html).not.toContain('[!NOTE]')
    expect(html).not.toContain('mu-alert-title')
    await exportToFile(app, page, 'pdf', pdfPath)
    expect(fs.readFileSync(pdfPath).subarray(0, 5).toString()).toBe('%PDF-')
  } finally {
    await app.close()
  }
})
