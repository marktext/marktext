import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'
const fixture = path.resolve('test/fixtures/fake-acp-agent/agent.mjs')
const scenarioDir = path.resolve('test/fixtures/fake-acp-agent/scenarios')

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

const prepareRepo = (name: string, body: string): { repoDir: string; guide: string; script: string } => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), `marktext-${name}-`))
  const script = harnessScript(repoDir)
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  const guide = path.join(repoDir, 'guide.md')
  fs.writeFileSync(guide, body)
  execFileSync('git', ['add', '--', 'guide.md'], { cwd: repoDir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  return { repoDir, guide, script }
}

const editorWindow = async(app: ElectronApplication, page: Page, marker: string): Promise<Page> => {
  let found = page
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
  await waitForEditor(found)
  const windowId = await found.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id)?.setSize(1600, 1000)
  }, windowId)
  return found
}

const openSettings = async(app: ElectronApplication, page: Page): Promise<Page> => {
  await page.evaluate(() => {
    window.electron.ipcRenderer.send('mt::open-setting-window')
  })
  let settings = page
  await expect.poll(async() => {
    for (const candidate of app.windows()) {
      if (await candidate.locator('.pref-sidebar').count()) {
        settings = candidate
        return true
      }
    }
    return false
  }).toBe(true)
  return settings
}

const panelCount = async(app: ElectronApplication): Promise<number> => {
  let count = 0
  for (const candidate of app.windows()) {
    count += await candidate.locator('.agent-panel').count()
  }
  return count
}

test('saves a harness path, lists its models, and hides every agent panel when mode is off', async() => {
  test.setTimeout(120_000)
  const first = prepareRepo('settings', MARKDOWN)
  const second = prepareRepo('settings-b', 'Gamma window phrase.\n')
  const launched = await launchElectron([first.repoDir, first.guide], {
    env: {
      FAKE_ACP_SCENARIO: path.join(scenarioDir, 'happy-two-threads.json'),
      FAKE_ACP_CWD: first.repoDir
    }
  })
  try {
    await waitForMenuReady(launched.app)
    const page = await editorWindow(launched.app, launched.page, 'strict')
    await expect.poll(() => panelCount(launched.app)).toBeGreaterThan(0)
    const settings = await openSettings(launched.app, page)
    await settings.locator('.pref-sidebar .item', { hasText: /^(Agent|Агент)$/ }).click()
    await settings.locator('#path-opencode').fill(first.script)
    await settings.getByRole('button', { name: /^(Check OpenCode|Проверить OpenCode)$/ }).click()
    const card = settings.locator('.card', { hasText: 'OpenCode' }).first()
    await expect(card).toContainText(/Found:|Найден:/, { timeout: 40000 })
    await expect(card.getByRole('list', { name: /Models for OpenCode|Модели OpenCode/ })).toContainText('Alpha')
    await expect(card.getByRole('list', { name: /Models for OpenCode|Модели OpenCode/ })).toContainText('Beta')

    await page.evaluate(() => new Promise<void>((resolve) => {
      const off = window.electron.ipcRenderer.on('mt::user-preference', (_event, partial) => {
        if (!partial || typeof partial !== 'object') return
        if ((partial as { openFolderInNewWindow?: boolean }).openFolderInNewWindow !== true) return
        off()
        resolve()
      })
      window.electron.ipcRenderer.send('mt::set-user-preference', { openFolderInNewWindow: true })
    }))
    const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
    await launched.app.evaluate(({ ipcMain }, payload: { windowId: number; dir: string }) => {
      ipcMain.emit('app-open-directory-by-id', payload.windowId, payload.dir, false)
    }, { windowId, dir: second.repoDir })
    await expect.poll(() => panelCount(launched.app), { timeout: 20000 }).toBeGreaterThan(1)

    await settings.getByRole('switch', { name: /^(Agent mode|Агентский режим)$/ }).click()
    await expect.poll(() => panelCount(launched.app), { timeout: 20000 }).toBe(0)
    let terminals = 0
    for (const candidate of launched.app.windows()) {
      terminals += await candidate.locator('.terminal-panel').count()
    }
    expect(terminals).toBe(0)
  } finally {
    await launched.app.close().catch(() => undefined)
    fs.rmSync(first.repoDir, { recursive: true, force: true })
    fs.rmSync(second.repoDir, { recursive: true, force: true })
  }
})

test('shows no configured models and disables the chat model picker', async() => {
  test.setTimeout(120_000)
  const repo = prepareRepo('no-models', MARKDOWN)
  const launched = await launchElectron([repo.repoDir, repo.guide], {
    env: {
      FAKE_ACP_SCENARIO: path.join(scenarioDir, 'no-models.json'),
      FAKE_ACP_CWD: repo.repoDir
    },
    preferences: {
      agentHarness: 'opencode',
      agentOpencodePath: repo.script
    }
  })
  try {
    await waitForMenuReady(launched.app)
    const page = await editorWindow(launched.app, launched.page, 'strict')
    await page.getByRole('tab', { name: /Chat|Чат/ }).click()
    const chat = page.locator('.mt-chat')
    await expect(chat).toContainText(/No models|Нет настроенных моделей/, { timeout: 40000 })
    await expect(chat.getByRole('combobox', { name: /Model|Модель/ })).toBeDisabled()

    const settings = await openSettings(launched.app, page)
    await settings.locator('.pref-sidebar .item', { hasText: /^(Agent|Агент)$/ }).click()
    const card = settings.locator('.card', { hasText: 'OpenCode' }).first()
    await expect(card).toContainText(/No models configured|Нет настроенных моделей/, { timeout: 40000 })
  } finally {
    await launched.app.close().catch(() => undefined)
    fs.rmSync(repo.repoDir, { recursive: true, force: true })
  }
})
