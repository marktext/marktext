import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'

const prepareRepo = (): string => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-term-'))
  execFileSync('git', ['init'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.email', 'tester@example.com'], { cwd: repoDir })
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir })
  const guide = path.join(repoDir, 'guide.md')
  fs.writeFileSync(guide, MARKDOWN)
  execFileSync('git', ['add', '--', 'guide.md'], { cwd: repoDir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoDir })
  fs.appendFileSync(guide, 'agent line\n')
  fs.writeFileSync(path.join(repoDir, 'notes.md'), 'agent wrote this\n')
  fs.writeFileSync(path.join(repoDir, 'ready.md'), 'ready to commit\n')
  const comments = path.join(repoDir, '.marktext', 'comments', 'guide.md.json')
  fs.mkdirSync(path.dirname(comments), { recursive: true })
  fs.writeFileSync(comments, `${JSON.stringify({ version: 1, file: 'guide.md', threads: [] }, null, 2)}\n`)
  return repoDir
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
  return found
}

const porcelain = (repoDir: string): string =>
  execFileSync('git', ['status', '--porcelain'], { cwd: repoDir, encoding: 'utf8' })

test('runs git in the repository root and keeps agent edits uncommitted', async() => {
  test.setTimeout(120_000)
  const repoDir = prepareRepo()
  const guide = path.join(repoDir, 'guide.md')
  const launched = await launchElectron([repoDir, guide])
  try {
    await waitForMenuReady(launched.app)
    const page = await editorWindow(launched.app, launched.page)
    await page.getByRole('button', { name: /^(Terminal|Терминал)$/ }).click()
    const screen = page.locator('.term-host:visible .xterm')
    await expect(screen).toBeVisible({ timeout: 20000 })
    await expect.poll(async() => (await screen.innerText()).includes('$') || (await screen.innerText()).includes('%')).toBe(true)

    const typeLine = async(line: string): Promise<void> => {
      await page.locator('.term-host:visible .xterm-helper-textarea').focus()
      await page.keyboard.type(line, { delay: 8 })
      await page.keyboard.press('Enter')
    }

    await typeLine('git --no-pager status')
    await expect(screen).toContainText('notes.md', { timeout: 20000 })
    await expect(screen).toContainText('ready.md')

    await typeLine('git add -- ready.md && git commit -m from-terminal')
    await expect.poll(() => {
      try {
        return execFileSync('git', ['log', '-1', '--format=%s'], { cwd: repoDir, encoding: 'utf8' }).trim()
      } catch {
        return ''
      }
    }, { timeout: 20000 }).toBe('from-terminal')

    const committed = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], {
      cwd: repoDir,
      encoding: 'utf8'
    }).trim()
    expect(committed).toBe('ready.md')
    const left = porcelain(repoDir)
    expect(left).toContain('notes.md')
    expect(left).toContain('guide.md')
    expect(left).toMatch(/\.marktext\//)
    expect(left).not.toContain('ready.md')

    await page.getByRole('button', { name: /^(New terminal|Новый терминал)$/ }).click()
    await expect(page.locator('.term-tab-name')).toHaveCount(2)
    const second = page.locator('.term-host:visible .xterm')
    await expect.poll(async() => (await second.innerText()).includes('$') || (await second.innerText()).includes('%')).toBe(true)
    await typeLine('echo TABTWO')
    await expect(second).toContainText('TABTWO', { timeout: 20000 })

    await page.locator('.term-tab-name').first().click()
    const first = page.locator('.term-host:visible .xterm')
    await expect(first).toContainText('from-terminal')
    await expect(first).not.toContainText('TABTWO')
  } finally {
    await launched.app.close().catch(() => undefined)
    fs.rmSync(repoDir, { recursive: true, force: true })
  }
})
