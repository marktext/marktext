import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'
const fixture = path.resolve('test/fixtures/fake-acp-agent/agent.mjs')
const scenario = path.resolve('test/fixtures/fake-acp-agent/scenarios/diff-notes.json')

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

const prepareRepo = (): { repoDir: string; guide: string; notes: string; script: string } => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-diff-'))
  const script = harnessScript(repoDir)
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  const guide = path.join(repoDir, 'guide.md')
  const other = path.join(repoDir, 'other.md')
  fs.writeFileSync(guide, MARKDOWN)
  fs.writeFileSync(other, 'base\n')
  execFileSync('git', ['add', '--', 'guide.md', 'other.md'], { cwd: repoDir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  fs.writeFileSync(other, 'base\nhuman-before\n')
  return { repoDir, guide, notes: path.join(repoDir, 'notes.md'), script }
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

const sendToEditor = async(
  app: ElectronApplication,
  page: Page,
  channel: string,
  ...args: unknown[]
): Promise<void> => {
  const windowId = await page.evaluate(() => window.marktext?.env?.windowId ?? -1)
  await app.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.fromId(payload.windowId)?.webContents.send(payload.channel, ...payload.args)
  }, { windowId, channel, args })
}

test('shows the turn diff, the working copy, a later edit, and keeps undo', async() => {
  test.setTimeout(120_000)
  const { repoDir, guide, notes, script } = prepareRepo()
  const launched = await launchElectron([repoDir, guide], {
    env: {
      FAKE_ACP_SCENARIO: scenario,
      FAKE_ACP_CWD: repoDir
    }
  })
  try {
    await waitForMenuReady(launched.app)
    const page = await editorWindow(launched.app, launched.page)
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
    await expect(chat.locator('select').nth(1).locator('option').first()).toBeAttached({ timeout: 20000 })

    await page.locator('.mu-paragraph-content').first().click()
    await page.keyboard.type('Q')
    await expect(page.locator('.editor-component')).toContainText('Q')

    await chat.locator('textarea').fill('write the notes')
    await chat.locator('button.primary').click()

    const diffTab = page.locator('.diff-tab-name')
    await expect(diffTab).toBeVisible({ timeout: 20000 })
    const diff = page.locator('.mt-diff')
    await expect(diff).toBeVisible()
    await expect(page.locator('.editor-component')).toBeHidden()
    const files = diff.locator('nav.files')
    await expect(files).toContainText('notes.md', { timeout: 20000 })
    await expect(files).not.toContainText('other.md')
    await expect(diff.locator('.pane')).toContainText('agent line')
    await expect(diff.getByRole('button', { name: /relative to HEAD|относительно HEAD/ }).first()).toBeVisible()

    await diff.getByRole('button', { name: /Entire working copy|Вся рабочая копия/ }).click()
    await expect(files).toContainText('other.md')
    await expect(files).toContainText('notes.md')
    await expect(diff.locator('.pane')).toContainText('human-before')

    await page.locator('.tabs-container li', { hasText: 'guide.md' }).click()
    await expect(page.locator('.editor-component')).toBeVisible()
    await expect(page.locator('.editor-component')).toContainText('Q')
    await expect.poll(async() => {
      await sendToEditor(launched.app, page, 'mt::editor-edit-action', 'undo')
      return page.locator('.editor-component').innerText()
    }).not.toContain('Q')

    await page.evaluate((file) => {
      window.electron.ipcRenderer.send('mt::open-file', file, {})
    }, notes)
    await expect(page.locator('.tabs-container li', { hasText: 'notes.md' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.editor-component')).toContainText('agent line')
    await page.locator('.mu-paragraph-content').first().click()
    await page.keyboard.type(' human-after')
    await sendToEditor(launched.app, page, 'mt::editor-ask-file-save')
    await expect.poll(() => fs.readFileSync(notes, 'utf8')).toContain('human-after')

    await diffTab.click()
    await diff.getByRole('button', { name: /Turn:|Ход:/ }).click()
    await diff.getByRole('button', { name: /^(Refresh|Обновить)$/ }).click()
    await expect(diff.locator('.pane')).toContainText('human-after', { timeout: 20000 })
    await expect(files).toContainText('notes.md')
    await expect(files).not.toContainText('other.md')
  } finally {
    await launched.app.close().catch(() => undefined)
    fs.rmSync(repoDir, { recursive: true, force: true })
  }
})
