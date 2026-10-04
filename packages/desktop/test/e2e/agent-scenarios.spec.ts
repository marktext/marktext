import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import {
  agentHarnessPreferences,
  fakeAcpScenario,
  launchElectron,
  waitForEditor,
  waitForMenuReady,
  writeFakeHarness
} from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'

interface Repo {
  repoDir: string
  harnessPath: string
}

const gitRepo = (name: string, files: Record<string, string>): Repo => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), `marktext-${name}-`))
  const harnessPath = writeFakeHarness(repoDir)
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(repoDir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  const names = Object.keys(files)
  if (names.length) {
    execFileSync('git', ['add', '--', ...names], { cwd: repoDir })
    execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  }
  return { repoDir, harnessPath }
}

const writeComments = (root: string, file: string, threads: unknown[]): void => {
  const target = path.join(root, '.marktext', 'comments', `${file}.json`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify({ version: 1, file, threads }, null, 2)}\n`)
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

const sessionText = (userData: string): string => {
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

const editorPage = async(app: ElectronApplication, marker: string): Promise<Page> => {
  let found = app.windows()[0]
  await expect.poll(async() => {
    for (const candidate of app.windows()) {
      const text = await candidate.locator('body').innerText().catch(() => '')
      if (text.includes(marker)) {
        found = candidate
        return true
      }
    }
    return false
  }).toBe(true)
  if (!found) throw new Error('editor window missing')
  await waitForEditor(found)
  const windowId = await found.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ BrowserWindow }, id) => {
    const win = BrowserWindow.fromId(id)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    win.setContentSize(1600, 1000)
  }, windowId)
  await found.waitForFunction(() => window.innerWidth >= 1500, null, { timeout: 15000 })
  await found.waitForFunction(
    () => {
      const panel = document.querySelector('.agent-panel')
      return !!panel && !panel.classList.contains('rail')
    },
    null,
    { timeout: 15000 }
  )
  return found
}

const clickMenu = async(app: ElectronApplication, page: Page, menuId: string): Promise<void> => {
  const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ Menu, BrowserWindow }, payload) => {
    const menu = Menu.getApplicationMenu()
    if (!menu) throw new Error('Application menu is not built yet')
    const item = menu.getMenuItemById(payload.menuId)
    if (!item) throw new Error('Menu id not found: ' + payload.menuId)
    const win = BrowserWindow.fromId(payload.windowId)
    if (!win) throw new Error('Editor window is gone')
    if (item.type === 'checkbox') item.checked = !item.checked
    item.click(undefined, win, win.webContents)
  }, { menuId, windowId })
}

const enterSource = async(app: ElectronApplication, page: Page): Promise<void> => {
  if (await page.locator('.source-code .CodeMirror').count()) return
  await clickMenu(app, page, 'sourceCodeModeMenuItem')
  await page.waitForFunction(() => {
    const node = document.querySelector('.source-code .CodeMirror') as { CodeMirror?: unknown } | null
    return !!node?.CodeMirror
  })
}

const selectQuote = (page: Page): Promise<void> => page.evaluate(() => {
  const node = document.querySelector('.source-code .CodeMirror') as {
    CodeMirror?: {
      focus(): void
      setSelection(a: { line: number; ch: number }, b: { line: number; ch: number }): void
    }
  } | null
  node?.CodeMirror?.focus()
  node?.CodeMirror?.setSelection({ line: 0, ch: 6 }, { line: 0, ch: 12 })
})

const commentOnSelection = async(app: ElectronApplication, page: Page): Promise<void> => {
  const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id)?.webContents.send('mt::execute-command-by-id', 'comments.comment')
  }, windowId)
}

const launchRepo = async(
  repo: Repo,
  file: string,
  env: Record<string, string> = {},
  userDataDir?: string
): Promise<{ app: ElectronApplication; page: Page; userData: string }> => {
  const launched = await launchElectron([repo.repoDir, path.join(repo.repoDir, file)], {
    userDataDir,
    preferences: userDataDir ? undefined : agentHarnessPreferences(repo.harnessPath),
    env: { FAKE_ACP_CWD: repo.repoDir, ...env }
  })
  await waitForMenuReady(launched.app)
  const page = await editorPage(launched.app, 'strict')
  // The seeded path is already the harness. Selecting a model, then moving the
  // harness radio, reloads the chat. Wait until the header says Pi and a
  // session exists: that harness is the one that stores the reply block.
  await page.evaluate(async(harness) => {
    await window.agent.setSelection('alpha')
    window.electron.ipcRenderer.send('mt::set-user-preference', {
      agentHarness: 'pi',
      agentPiPath: harness
    })
  }, repo.harnessPath)
  const chat = page.locator('.mt-chat')
  await expect(chat.locator('.harness-label')).toHaveText('Pi', { timeout: 20000 })
  const model = chat.locator('select[aria-label="Model"], select[aria-label="Модель"]')
  await expect.poll(() => model.inputValue(), { timeout: 20000 }).toBe('alpha')
  await expect(chat.locator('select').nth(1).locator('option').first()).toBeAttached({ timeout: 20000 })
  const userData = await launched.app.evaluate(async({ app }) => app.getPath('userData'))
  return { app: launched.app, page, userData }
}

test.describe('TZ scenarios', () => {
  test.describe.configure({ timeout: 120_000 })

  test('TZ 1 saves a comment beside the markdown', async() => {
    const repo = gitRepo('tz1', { 'guide.md': MARKDOWN })
    const guide = path.join(repo.repoDir, 'guide.md')
    const launched = await launchElectron([repo.repoDir, guide], {
      preferences: agentHarnessPreferences(repo.harnessPath)
    })
    try {
      await waitForMenuReady(launched.app)
      const page = await editorPage(launched.app, 'strict')
      await enterSource(launched.app, page)
      await selectQuote(page)
      await commentOnSelection(launched.app, page)
      const draft = page.locator('.mt-comments .draft')
      await expect(draft).toBeVisible()
      await draft.locator('textarea').fill('look here')
      await draft.locator('button.primary').click()

      const commentsPath = path.join(repo.repoDir, '.marktext', 'comments', 'guide.md.json')
      await expect.poll(() => fs.existsSync(commentsPath)).toBe(true)
      const stored = JSON.parse(fs.readFileSync(commentsPath, 'utf8')) as {
        threads: Array<{ anchor: { quote: string } }>
      }
      expect(stored.threads[0]?.anchor.quote).toBe('strict')
      expect(fs.readFileSync(guide, 'utf8')).toBe(MARKDOWN)
    } finally {
      await launched.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 3 keeps each sent thread open and stores the agent reply', async() => {
    const repo = gitRepo('tz3', { 'guide.md': MARKDOWN })
    writeComments(repo.repoDir, 'guide.md', [
      thread('t-strict', 'strict'),
      thread('t-beta', 'Beta paragraph')
    ])
    const opened = await launchRepo(repo, 'guide.md', {
      FAKE_ACP_SCENARIO: fakeAcpScenario('happy-two-threads.json'),
      FAKE_ACP_BLOCK: JSON.stringify([
        { threadId: 't-strict', text: 'fixed strict' },
        { threadId: 't-beta', text: 'fixed beta' }
      ])
    })
    try {
      const sendAll = opened.page.locator('button', { hasText: /Send all unresolved|Отправить все неразобранные/ })
      await expect(sendAll).toBeEnabled({ timeout: 20000 })
      await sendAll.click()
      const commentsPath = path.join(repo.repoDir, '.marktext', 'comments', 'guide.md.json')
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
      // Closing while the turn is still running asks for confirmation.
      await expect(sendAll).toBeEnabled({ timeout: 20000 })
    } finally {
      await opened.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 4 sends only the open threads of the current file', async() => {
    const repo = gitRepo('tz4', {
      'guide.md': MARKDOWN,
      'notes.md': 'A foreign quote sits here.\n'
    })
    writeComments(repo.repoDir, 'guide.md', [
      thread('t-strict', 'strict'),
      thread('t-beta', 'Beta paragraph'),
      thread('t-gamma', 'Gamma closed sentence', 'closed')
    ])
    writeComments(repo.repoDir, 'notes.md', [thread('t-foreign', 'foreign quote')])
    const opened = await launchRepo(repo, 'guide.md', {
      FAKE_ACP_SCENARIO: fakeAcpScenario('happy-two-threads.json')
    })
    try {
      const sendAll = opened.page.locator('button', { hasText: /Send all unresolved|Отправить все неразобранные/ })
      await expect(sendAll).toBeEnabled({ timeout: 20000 })
      await sendAll.click({ timeout: 15000 })
      await expect.poll(() => sessionText(opened.userData), { timeout: 20000 }).toContain('strict')
      const prompt = sessionText(opened.userData)
      expect(prompt).toContain('Beta paragraph')
      expect(prompt).not.toContain('foreign quote')
      expect(prompt).not.toContain('Gamma closed sentence')
      // The prompt is stored at the start of the turn. Closing while it is
      // still running asks for confirmation and the window stays open.
      await expect(sendAll).toBeEnabled({ timeout: 20000 })
    } finally {
      await opened.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 5 reopens the last session after a restart', async() => {
    const repo = gitRepo('tz5', { 'guide.md': MARKDOWN })
    const opened = await launchRepo(repo, 'guide.md', {
      FAKE_ACP_SCENARIO: fakeAcpScenario('happy-two-threads.json')
    })
    let second: ElectronApplication | undefined
    try {
      await opened.page.getByRole('tab', { name: /Chat|Чат/ }).click({ timeout: 15000 })
      const chat = opened.page.locator('.mt-chat')
      const send = chat.locator('button.primary')
      await expect(send).toBeVisible({ timeout: 20000 })
      await chat.locator('textarea').fill('Where is the lockfile?')
      await expect(send).toBeEnabled({ timeout: 20000 })
      await send.click({ timeout: 15000 })
      await expect(chat).toContainText('Where is the lockfile?', { timeout: 20000 })
      await expect(send).toBeVisible({ timeout: 20000 })
      await expect.poll(() => sessionText(opened.userData), { timeout: 20000 }).toContain('Where is the lockfile?')
      const newest = await chat.locator('select').nth(1).inputValue()
      await opened.app.close()

      // Restart reads the preferences the first launch already saved, including
      // the fake-agent path. Switching the harness here reloads the chat before
      // the saved session is shown.
      const again = await launchElectron([repo.repoDir, path.join(repo.repoDir, 'guide.md')], {
        userDataDir: opened.userData,
        env: {
          FAKE_ACP_CWD: repo.repoDir,
          FAKE_ACP_SCENARIO: fakeAcpScenario('happy-two-threads.json')
        }
      })
      second = again.app
      await waitForMenuReady(again.app)
      const page = await editorPage(again.app, 'strict')
      await page.getByRole('tab', { name: /Chat|Чат/ }).click({ timeout: 15000 })
      await expect(page.locator('.mt-chat select').nth(1)).toHaveValue(newest, { timeout: 20000 })
      await expect(page.locator('.mt-chat')).toContainText('Where is the lockfile?', { timeout: 20000 })
    } finally {
      await second?.close().catch(() => undefined)
      await opened.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 6 blocks send during a turn and stop ends it', async() => {
    const repo = gitRepo('tz6', { 'guide.md': MARKDOWN })
    writeComments(repo.repoDir, 'guide.md', [thread('t-strict', 'strict')])
    const opened = await launchRepo(repo, 'guide.md', {
      FAKE_ACP_SCENARIO: fakeAcpScenario('cancel-mid-turn.json')
    })
    try {
      const sendAll = opened.page.locator('button', { hasText: /Send all unresolved|Отправить все неразобранные/ })
      const sendOne = opened.page.locator('button', { hasText: /Send to agent|Отправить агенту/ })
      await expect(sendAll).toBeEnabled({ timeout: 20000 })
      await opened.page.locator('.mt-comments button.card', { hasText: 'strict' }).click()
      await expect(sendOne).toBeEnabled()
      await sendAll.click()
      await expect(sendAll).toBeDisabled({ timeout: 20000 })
      await expect(sendOne).toBeDisabled()
      const stop = opened.page.getByRole('button', { name: /^(Stop|Остановить)$/ })
      await expect(stop).toBeVisible()
      await stop.click()
      await expect(opened.page.locator('.mt-chat')).toContainText(/Turn stopped|Ход остановлен/, { timeout: 20000 })
    } finally {
      await opened.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 7 shows the turn diff and the whole working copy separately', async() => {
    const repo = gitRepo('tz7', { 'guide.md': MARKDOWN, 'other.md': 'base\n' })
    fs.writeFileSync(path.join(repo.repoDir, 'other.md'), 'base\nhuman-before\n')
    const opened = await launchRepo(repo, 'guide.md', {
      FAKE_ACP_SCENARIO: fakeAcpScenario('diff-notes.json')
    })
    try {
      await opened.page.getByRole('tab', { name: /Chat|Чат/ }).click()
      const chat = opened.page.locator('.mt-chat')
      const send = chat.locator('button.primary')
      await expect(send).toBeVisible({ timeout: 20000 })
      await chat.locator('textarea').fill('write the notes')
      await send.click()
      const diff = opened.page.locator('.mt-diff')
      await expect(diff).toBeVisible({ timeout: 20000 })
      const files = diff.locator('nav.files')
      await expect(files).toContainText('notes.md', { timeout: 20000 })
      await expect(files).not.toContainText('other.md')
      await diff.getByRole('button', { name: /Entire working copy|Вся рабочая копия/ }).click()
      await expect(files).toContainText('other.md')
      await expect(files).toContainText('notes.md')
    } finally {
      await opened.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 8 commits from the terminal without the agent edits', async() => {
    const repo = gitRepo('tz8', { 'guide.md': MARKDOWN })
    fs.appendFileSync(path.join(repo.repoDir, 'guide.md'), 'agent line\n')
    fs.writeFileSync(path.join(repo.repoDir, 'notes.md'), 'agent wrote this\n')
    fs.writeFileSync(path.join(repo.repoDir, 'ready.md'), 'ready to commit\n')
    writeComments(repo.repoDir, 'guide.md', [])
    const guide = path.join(repo.repoDir, 'guide.md')
    const launched = await launchElectron([repo.repoDir, guide], {
      preferences: agentHarnessPreferences(repo.harnessPath)
    })
    try {
      await waitForMenuReady(launched.app)
      const page = await editorPage(launched.app, 'strict')
      await page.getByRole('button', { name: /^(Terminal|Терминал)$/ }).click()
      const screen = page.locator('.term-host:visible .xterm')
      await expect(screen).toBeVisible({ timeout: 20000 })
      await expect.poll(async() => {
        const text = await screen.innerText()
        return text.includes('$') || text.includes('%')
      }).toBe(true)
      await page.locator('.term-host:visible .xterm-helper-textarea').focus()
      await page.keyboard.type('git add -- ready.md && git commit -m from-terminal', { delay: 8 })
      await page.keyboard.press('Enter')
      await expect.poll(() => {
        try {
          return execFileSync('git', ['log', '-1', '--format=%s'], { cwd: repo.repoDir, encoding: 'utf8' }).trim()
        } catch {
          return ''
        }
      }, { timeout: 20000 }).toBe('from-terminal')
      const committed = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], {
        cwd: repo.repoDir,
        encoding: 'utf8'
      }).trim()
      expect(committed).toBe('ready.md')
      const left = execFileSync('git', ['status', '--porcelain'], { cwd: repo.repoDir, encoding: 'utf8' })
      expect(left).toContain('notes.md')
      expect(left).toContain('guide.md')
      expect(left).toMatch(/\.marktext\//)
      expect(left).not.toContain('ready.md')
    } finally {
      await launched.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 9 detaches a thread when the quote is removed', async() => {
    const repo = gitRepo('tz9', { 'guide.md': MARKDOWN })
    const guide = path.join(repo.repoDir, 'guide.md')
    const launched = await launchElectron([repo.repoDir, guide], {
      preferences: agentHarnessPreferences(repo.harnessPath)
    })
    try {
      await waitForMenuReady(launched.app)
      const page = await editorPage(launched.app, 'strict')
      await enterSource(launched.app, page)
      await selectQuote(page)
      await commentOnSelection(launched.app, page)
      const draft = page.locator('.mt-comments .draft')
      await expect(draft).toBeVisible()
      await draft.locator('textarea').fill('look here')
      await draft.locator('button.primary').click()
      await expect.poll(() =>
        fs.existsSync(path.join(repo.repoDir, '.marktext', 'comments', 'guide.md.json'))
      ).toBe(true)
      await page.evaluate(() => {
        const node = document.querySelector('.source-code .CodeMirror') as {
          CodeMirror?: {
            replaceRange(text: string, from: { line: number; ch: number }, to: { line: number; ch: number }): void
          }
        } | null
        node?.CodeMirror?.replaceRange('loose', { line: 0, ch: 6 }, { line: 0, ch: 12 })
      })
      await expect(page.getByText(/Quote was not found|Цитата не найдена/)).toBeVisible({ timeout: 15000 })
    } finally {
      await launched.app.close().catch(() => undefined)
      fs.rmSync(repo.repoDir, { recursive: true, force: true })
    }
  })

  test('TZ 10 keeps the panel and hides commands outside a git repository', async() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-tz10-'))
    const harnessPath = writeFakeHarness(dir)
    fs.writeFileSync(path.join(dir, 'notes.md'), 'A plain folder.\n')
    const launched = await launchElectron([dir, path.join(dir, 'notes.md')], {
      preferences: agentHarnessPreferences(harnessPath)
    })
    try {
      await waitForMenuReady(launched.app)
      let page = launched.page
      await expect.poll(async() => {
        for (const candidate of launched.app.windows()) {
          if (await candidate.locator('.editor-component').count()) {
            page = candidate
            return true
          }
        }
        return false
      }).toBe(true)
      await waitForEditor(page)
      const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
      await launched.app.evaluate(({ BrowserWindow }, id) => {
        const win = BrowserWindow.fromId(id)
        if (!win) return
        if (win.isMaximized()) win.unmaximize()
        win.setContentSize(1600, 1000)
      }, windowId)
      await page.waitForFunction(() => window.innerWidth >= 1500)
      await expect(page.locator('.agent-panel')).toContainText(
        /Agent mode works only in a git repository folder\.|Агентский режим работает только в папке git-репозитория\./
      )
      await expect(page.locator('.terminal-panel')).toHaveCount(0)
      await expect(page.locator('.mt-chat')).toHaveCount(0)
      await expect(page.locator('.mt-comments')).toHaveCount(0)
    } finally {
      await launched.app.close().catch(() => undefined)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
