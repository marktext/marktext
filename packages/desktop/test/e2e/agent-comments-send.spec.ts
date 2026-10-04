import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n\nGamma closed sentence.\n'
const KEPT = 'Kept.'

const fixture = path.resolve('test/fixtures/fake-acp-agent/agent.mjs')
const scenario = path.resolve('test/fixtures/fake-acp-agent/scenarios/happy-two-threads.json')

const editorWindowId = (page: Page): Promise<number> =>
  page.evaluate(() => window.marktext?.env?.windowId ?? -1)

const clickMenuOnPage = async(
  app: ElectronApplication,
  page: Page,
  menuId: string
): Promise<void> => {
  const windowId = await editorWindowId(page)
  await app.evaluate(
    ({ Menu, BrowserWindow }, payload) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) throw new Error('Application menu is not built yet')
      const item = menu.getMenuItemById(payload.menuId)
      if (!item) throw new Error('Menu id not found: ' + payload.menuId)
      const win = BrowserWindow.fromId(payload.windowId)
      if (!win) throw new Error('Editor window is gone')
      if (item.type === 'checkbox') item.checked = !item.checked
      item.click(undefined, win, win.webContents)
    },
    { menuId, windowId }
  )
}

const enterSourceMode = async(page: Page, app: ElectronApplication): Promise<void> => {
  const already = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (already) return
  await clickMenuOnPage(app, page, 'sourceCodeModeMenuItem')
  await page.waitForFunction(
    () => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: unknown })
        | null
      return !!cm?.CodeMirror
    },
    null,
    { timeout: 10000 }
  )
}

const human = (id: string, text: string) => ({
  id,
  author: { kind: 'human', name: 'Ada' },
  text,
  createdAt: '2026-10-02T15:04:00.000Z',
  editedAt: null
})

const thread = (id: string, quote: string, status: 'open' | 'closed' = 'open') => ({
  id,
  status,
  createdAt: '2026-10-02T15:04:00.000Z',
  closedAt: status === 'closed' ? '2026-10-02T18:00:00.000Z' : null,
  anchor: { quote, prefix: '', suffix: '', blockHint: { type: 'paragraph', index: 0 } },
  messages: [human(`${id}-m`, quote)]
})

const writeComments = (root: string, file: string, threads: unknown[]): void => {
  const target = path.join(root, '.marktext', 'comments', `${file}.json`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify({ version: 1, file, threads }, null, 2)}\n`)
}

const sessionPrompt = (userData: string): string => {
  const root = path.join(userData, 'agent', 'sessions')
  const texts: string[] = []
  const walk = (current: string): void => {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.jsonl')) {
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          if (!line) continue
          const parsed = JSON.parse(line) as { type?: string; text?: string }
          if (parsed.type === 'user_message' && parsed.text) texts.push(parsed.text)
        }
      }
    }
  }
  walk(root)
  return texts.join('\n')
}

test('sends this file’s open threads through the fake agent', async() => {
  test.setTimeout(90_000)
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-send-'))
  const harness = path.join(repoDir, 'fake-harness')
  fs.writeFileSync(
    harness,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`,
    { mode: 0o755 }
  )
  fs.chmodSync(harness, 0o755)
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  const guide = path.join(repoDir, 'guide.md')
  fs.writeFileSync(guide, MARKDOWN)
  fs.writeFileSync(path.join(repoDir, 'notes.md'), 'A foreign quote sits here.\n')
  writeComments(repoDir, 'guide.md', [
    thread('t-strict', 'strict'),
    thread('t-beta', 'Beta paragraph'),
    thread('t-gamma', 'Gamma closed sentence', 'closed')
  ])
  writeComments(repoDir, 'notes.md', [thread('t-foreign', 'foreign quote')])
  execFileSync('git', ['add', '--', 'guide.md', 'notes.md'], { cwd: repoDir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })

  const launched = await launchElectron([repoDir, guide], {
    env: {
      FAKE_ACP_SCENARIO: scenario,
      FAKE_ACP_CWD: repoDir,
      FAKE_ACP_WRITE: 'guide.md',
      FAKE_ACP_WRITE_BODY: 'after\n',
      FAKE_ACP_DELAY_MS: '4000',
      FAKE_ACP_BLOCK: JSON.stringify([
        { threadId: 't-strict', text: 'fixed strict' },
        { threadId: 't-beta', text: 'fixed beta' }
      ])
    }
  })
  const app = launched.app
  let page = launched.page

  try {
    await waitForMenuReady(app)
    await expect.poll(async() => {
      for (const candidate of app.windows()) {
        const text = await candidate.locator('body').innerText().catch(() => '')
        if (text.includes('strict')) {
          page = candidate
          return true
        }
      }
      return false
    }).toBe(true)
    await waitForEditor(page)
    const windowId = await editorWindowId(page)
    await app.evaluate(({ BrowserWindow }, id) => {
      BrowserWindow.fromId(id)?.setSize(1600, 1000)
    }, windowId)
    await page.waitForFunction(
      () => {
        const panel = document.querySelector('.agent-panel')
        return !!panel && !panel.classList.contains('rail')
      },
      null,
      { timeout: 15000 }
    )

    await page.evaluate(async() => {
      await window.agent.setSelection('alpha')
    })
    await page.evaluate((script) => {
      window.electron.ipcRenderer.send('mt::set-user-preference', {
        agentHarness: 'pi',
        agentPiPath: script
      })
    }, harness)

    const sendAll = page.locator('button', { hasText: /Send all unresolved|Отправить все неразобранные/ })
    const sendOne = page.locator('button', { hasText: /Send to agent|Отправить агенту/ })
    await expect(sendAll).toBeEnabled({ timeout: 20000 })

    await page.locator('.mt-comments button.card', { hasText: 'strict' }).click()
    await expect(sendOne).toBeEnabled()

    await enterSourceMode(page, app)
    // A caret move is what commits the source buffer into the tab.
    const edited = await page.evaluate((marker) => {
      const node = document.querySelector('.source-code .CodeMirror') as {
        CodeMirror?: {
          getValue(): string
          lastLine(): number
          getLine(line: number): string
          replaceRange(text: string, from: { line: number; ch: number }): void
          setCursor(pos: { line: number; ch: number }): void
        }
      } | null
      const cm = node?.CodeMirror
      if (!cm) return ''
      const line = cm.lastLine()
      cm.replaceRange(`\n${marker}`, { line, ch: cm.getLine(line).length })
      const end = cm.lastLine()
      cm.setCursor({ line: end, ch: cm.getLine(end).length })
      return cm.getValue()
    }, KEPT)
    expect(edited).toContain(KEPT)
    expect(fs.readFileSync(guide, 'utf8')).toBe(MARKDOWN)

    await sendAll.click()

    await expect.poll(() => fs.readFileSync(guide, 'utf8')).toContain(KEPT)
    await expect(page.getByRole('tab', { name: /^(Chat|Чат)$/ })).toHaveAttribute('aria-selected', 'true')
    await expect(sendAll).toBeDisabled()
    await expect(sendOne).toBeDisabled()

    const commentsPath = path.join(repoDir, '.marktext', 'comments', 'guide.md.json')
    await expect.poll(() => {
      const stored = JSON.parse(fs.readFileSync(commentsPath, 'utf8')) as {
        threads: Array<{ id: string; status: string; messages: Array<{ author: { kind: string }; text: string }> }>
      }
      const byId = new Map(stored.threads.map((item) => [item.id, item]))
      const strict = byId.get('t-strict')
      const beta = byId.get('t-beta')
      return strict?.status === 'open' &&
        beta?.status === 'open' &&
        strict.messages.some((message) => message.author.kind === 'agent' && message.text === 'fixed strict') &&
        beta.messages.some((message) => message.author.kind === 'agent' && message.text === 'fixed beta')
    }, { timeout: 20000 }).toBe(true)

    const userData = await app.evaluate(async({ app: electronApp }) => electronApp.getPath('userData'))
    const prompt = sessionPrompt(userData)
    expect(prompt).toContain('strict')
    expect(prompt).toContain('Beta paragraph')
    expect(prompt).not.toContain('foreign quote')
    expect(prompt).not.toContain('Gamma closed sentence')
  } finally {
    await app.close()
    fs.rmSync(repoDir, { recursive: true, force: true })
  }
})
