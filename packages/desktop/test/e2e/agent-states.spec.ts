import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor } from './helpers'

const NOT_REPO = /Agent mode works only in a git repository folder\.|Агентский режим работает только в папке git-репозитория\./

const themeTokens = async(page: Page): Promise<{ underline: string; orphan: string; read: string }> => {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      underline: style.getPropertyValue('--commentMarkUnderline').trim(),
      orphan: style.getPropertyValue('--tagOrphanFg').trim(),
      read: style.getPropertyValue('--tagReadFg').trim()
    }
  })
}

const setTheme = async(page: Page, theme: 'light' | 'dark'): Promise<void> => {
  await page.evaluate((next) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', { theme: next })
  }, theme)
}

test('a folder that is not a git repository keeps the agent panel and hides commands', async() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-not-repo-'))
  const notes = path.join(dir, 'notes.md')
  fs.writeFileSync(notes, 'A plain folder.\n')
  let app: ElectronApplication | undefined
  try {
    const launched = await launchElectron([dir, notes], {
      preferences: { agentModeEnabled: true, theme: 'light' }
    })
    app = launched.app
    let page = launched.page
    await expect.poll(async() => {
      for (const candidate of app.windows()) {
        const hasEditor = await candidate.locator('.editor-component').count()
        if (hasEditor) {
          page = candidate
          return 'editor'
        }
      }
      const snippets: string[] = []
      for (const candidate of app.windows()) {
        const text = await candidate.locator('body').innerText().catch(() => '')
        snippets.push(text.replace(/\s+/g, ' ').slice(0, 240))
      }
      return snippets.join(' | ') || 'no-window'
    }, { timeout: 20000 }).toBe('editor')
    await waitForEditor(page)
    const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
    await app.evaluate(({ BrowserWindow }, id) => {
      const win = BrowserWindow.fromId(id)
      if (!win) return
      if (win.isMaximized()) win.unmaximize()
      win.setContentSize(1600, 1000)
    }, windowId)
    await page.waitForFunction(() => window.innerWidth >= 1500)

    await expect(page.locator('.agent-panel')).toBeVisible()
    await expect(page.locator('.agent-tabs')).toBeVisible()
    await expect(page.locator('.terminal-panel')).toHaveCount(0)
    await expect(page.locator('.mt-chat')).toHaveCount(0)
    await expect(page.locator('.mt-comments')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Terminal|Терминал/ })).toHaveCount(0)

    const light = await themeTokens(page)
    expect(light.underline).toBe('#8a6410')
    expect(light.orphan).toBe('#6d4e0c')
    expect(light.read).toBe('#7a1e1e')

    await setTheme(page, 'dark')
    await expect.poll(() => themeTokens(page)).toEqual({
      underline: '#e2c15a',
      orphan: '#ffe08a',
      read: '#ffc1c1'
    })
    await expect(page.locator('.agent-panel')).toContainText(NOT_REPO)
    await expect(page.locator('body')).toHaveClass(/dark/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
    if (app) await app.close()
  }
})
