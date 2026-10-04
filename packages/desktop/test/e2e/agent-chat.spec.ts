import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'
const fixture = path.resolve('test/fixtures/fake-acp-agent/agent.mjs')
const scenarioDir = path.resolve('test/fixtures/fake-acp-agent/scenarios')

const human = (id: string, text: string) => ({
  id,
  author: { kind: 'human', name: 'Ada' },
  text,
  createdAt: '2026-10-02T15:04:00.000Z',
  editedAt: null
})

const thread = (id: string, quote: string) => ({
  id,
  status: 'open' as const,
  createdAt: '2026-10-02T15:04:00.000Z',
  closedAt: null,
  anchor: { quote, prefix: '', suffix: '', blockHint: { type: 'paragraph', index: 0 } },
  messages: [human(`${id}-m`, quote)]
})

const writeComments = (root: string, file: string, threads: unknown[]): void => {
  const target = path.join(root, '.marktext', 'comments', `${file}.json`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify({ version: 1, file, threads }, null, 2)}\n`)
}

const userMessages = (userData: string): Map<string, string[]> => {
  const root = path.join(userData, 'agent', 'sessions')
  const byFile = new Map<string, string[]>()
  const walk = (current: string): void => {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.jsonl')) {
        const texts: string[] = []
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          if (!line) continue
          const parsed = JSON.parse(line) as { type?: string; text?: string }
          if (parsed.type === 'user_message' && parsed.text) texts.push(parsed.text)
        }
        byFile.set(full, texts)
      }
    }
  }
  walk(root)
  return byFile
}

const harnessScript = (repoDir: string): string => {
  const script = path.join(repoDir, 'fake-harness')
  fs.writeFileSync(
    script,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} "$@"\n`,
    { mode: 0o755 }
  )
  fs.chmodSync(script, 0o755)
  return script
}

const prepareRepo = (name: string): { repoDir: string; guide: string; script: string } => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), `marktext-${name}-`))
  const script = harnessScript(repoDir)
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  const guide = path.join(repoDir, 'guide.md')
  fs.writeFileSync(guide, MARKDOWN)
  writeComments(repoDir, 'guide.md', [thread('t-strict', 'strict'), thread('t-beta', 'Beta paragraph')])
  execFileSync('git', ['add', '--', 'guide.md'], { cwd: repoDir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  return { repoDir, guide, script }
}

const editorWindow = async(app: ElectronApplication, page: Page): Promise<Page> => {
  let found = page
  await expect.poll(async() => {
    for (const candidate of app.windows()) {
      const text = await candidate.locator('body').innerText().catch(() => '')
      if (text.includes('strict')) {
        found = candidate
        return true
      }
    }
    return false
  }).toBe(true)
  await waitForEditor(found)
  const windowId = await found.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id)?.setSize(1600, 1000)
  }, windowId)
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

const arm = async(page: Page, script: string): Promise<void> => {
  await page.evaluate(async(harness) => {
    await window.agent.setSelection('alpha')
    window.electron.ipcRenderer.send('mt::set-user-preference', {
      agentHarness: 'pi',
      agentPiPath: harness,
      agentOpencodePath: harness
    })
  }, script)
  await page.getByRole('tab', { name: /Chat|Чат/ }).click()
  const chat = page.locator('.mt-chat')
  await expect(chat.locator('select').first().locator('option', { hasText: 'Alpha' })).toHaveCount(1, {
    timeout: 20000
  })
  // The session list is filled only after open-session returns, so a send
  // cannot land in the middle of that switch.
  await expect(chat.locator('select').nth(1).locator('option').first()).toBeAttached({ timeout: 20000 })
}

const launchReady = async(
  scenario: string,
  name: string
): Promise<{
  app: ElectronApplication
  page: Page
  repoDir: string
  guide: string
  script: string
  userData: string
}> => {
  const { repoDir, guide, script } = prepareRepo(name)
  const launched = await launchElectron([repoDir, guide], {
    env: {
      FAKE_ACP_SCENARIO: path.join(scenarioDir, scenario),
      FAKE_ACP_CWD: repoDir
    }
  })
  await waitForMenuReady(launched.app)
  const page = await editorWindow(launched.app, launched.page)
  await arm(page, script)
  const userData = await launched.app.evaluate(async({ app }) => app.getPath('userData'))
  return { app: launched.app, page, repoDir, guide, script, userData }
}

test('keeps comments and a later message in one session, then restores the newest chat', async() => {
  test.setTimeout(120_000)
  const ready = await launchReady('happy-two-threads.json', 'chat-session')
  let app = ready.app
  let page = ready.page
  try {
    await page.getByRole('tab', { name: /Comments|Комментарии/ }).click()
    const sendAll = page.locator('button', { hasText: /Send all unresolved|Отправить все неразобранные/ })
    await expect(sendAll).toBeEnabled({ timeout: 20000 })
    await sendAll.click()
    const chat = page.locator('.mt-chat')
    await expect(chat).toContainText(/File: guide\.md|strict/, { timeout: 20000 })
    const send = chat.locator('button.primary')
    await expect(send).toBeVisible({ timeout: 20000 })

    await chat.locator('textarea').fill('Where is the lockfile?')
    await send.click()
    await expect(chat).toContainText('Where is the lockfile?', { timeout: 20000 })
    await expect(send).toBeVisible({ timeout: 20000 })

    const sameSession = [...userMessages(ready.userData).values()].find((texts) =>
      texts.some((text) => text.includes('File: guide.md')) &&
      texts.some((text) => text.includes('Where is the lockfile?'))
    )
    expect(sameSession).toBeTruthy()

    const sessionSelect = chat.locator('select').nth(1)
    const previous = await sessionSelect.inputValue()
    await chat.locator('.hrow .textbtn').click()
    await expect(sessionSelect).not.toHaveValue(previous)
    await expect(sessionSelect.locator(`option[value="${previous}"]`)).toHaveCount(1)
    const newest = await sessionSelect.inputValue()

    await app.close()
    const again = await launchElectron([ready.repoDir, ready.guide], {
      userDataDir: ready.userData,
      env: {
        FAKE_ACP_SCENARIO: path.join(scenarioDir, 'happy-two-threads.json'),
        FAKE_ACP_CWD: ready.repoDir
      }
    })
    app = again.app
    await waitForMenuReady(app)
    page = await editorWindow(app, again.page)
    await page.getByRole('tab', { name: /Chat|Чат/ }).click()
    const restored = page.locator('.mt-chat select').nth(1)
    await expect(restored).toHaveValue(newest, { timeout: 20000 })

    await page.evaluate(() => {
      window.electron.ipcRenderer.send('mt::set-user-preference', { agentHarness: 'opencode' })
    })
    await expect(restored).not.toHaveValue(newest, { timeout: 20000 })
    await expect(restored).not.toContainText('Комментарии')
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(ready.repoDir, { recursive: true, force: true })
  }
})

test('answers a permission with the harness options', async() => {
  test.setTimeout(90_000)
  for (const [scenario, choice, reply] of [
    ['permission-allow.json', 'Allow once', 'allowed'],
    ['permission-reject.json', 'Reject once', 'rejected']
  ] as const) {
    const ready = await launchReady(scenario, choice)
    try {
      const chat = ready.page.locator('.mt-chat')
      await chat.locator('textarea').fill('check types')
      await chat.locator('button.primary').click()
      const permit = chat.locator('.permit')
      await expect(permit.getByRole('button', { name: choice })).toBeVisible({ timeout: 20000 })
      await expect(permit.getByRole('button', { name: 'Allow once' })).toBeVisible()
      await expect(permit.getByRole('button', { name: 'Reject once' })).toBeVisible()
      await permit.getByRole('button', { name: choice }).click()
      await expect(chat).toContainText(reply, { timeout: 20000 })
    } finally {
      await ready.app.close().catch(() => undefined)
      fs.rmSync(ready.repoDir, { recursive: true, force: true })
    }
  }
})

test('stops a running turn', async() => {
  test.setTimeout(90_000)
  const ready = await launchReady('cancel-mid-turn.json', 'chat-stop')
  try {
    const chat = ready.page.locator('.mt-chat')
    await chat.locator('textarea').fill('please wait')
    await chat.locator('button.primary').click()
    const stop = chat.getByRole('button', { name: /^(Stop|Остановить)$/ })
    await expect(stop).toBeVisible({ timeout: 20000 })
    await stop.click()
    await expect(chat).toContainText(/Turn stopped|Ход остановлен/, { timeout: 20000 })
  } finally {
    await ready.app.close().catch(() => undefined)
    fs.rmSync(ready.repoDir, { recursive: true, force: true })
  }
})

test('retries a crashed turn in the same session', async() => {
  test.setTimeout(90_000)
  const ready = await launchReady('crash.json', 'chat-crash')
  try {
    const chat = ready.page.locator('.mt-chat')
    const composer = chat.locator('textarea')
    await composer.fill('again please')
    await chat.locator('button.primary').click()
    const retry = chat.getByRole('button', { name: /^(Retry|Повторить)$/ })
    await expect(retry).toBeVisible({ timeout: 20000 })
    await expect(composer).toBeEnabled()
    await retry.click()
    await expect.poll(() => {
      for (const texts of userMessages(ready.userData).values()) {
        if (texts.filter((text) => text.includes('again please')).length >= 2) return true
      }
      return false
    }, { timeout: 20000 }).toBe(true)
  } finally {
    await ready.app.close().catch(() => undefined)
    fs.rmSync(ready.repoDir, { recursive: true, force: true })
  }
})
