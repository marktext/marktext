import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

const MARKDOWN = 'Alpha strict phrase.\n\nBeta paragraph stays apart.\n'

const editorWindowId = (page: Page): Promise<number> =>
  page.evaluate(() => window.marktext?.env?.windowId ?? -1)

const commentable = (app: ElectronApplication, page: Page): Promise<boolean | undefined> =>
  editorWindowId(page).then((windowId) =>
    app.evaluate(({ BrowserWindow }, id) => {
      const win = BrowserWindow.fromId(id) as { mtCommentAvailable?: boolean } | null
      return win?.mtCommentAvailable
    }, windowId)
  )

const runCommentCommand = async(app: ElectronApplication, page: Page): Promise<void> => {
  const windowId = await editorWindowId(page)
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id)?.webContents.send('mt::execute-command-by-id', 'comments.comment')
  }, windowId)
}

interface SourceEditor {
  focus(): void
  setSelection(anchor: { line: number; ch: number }, head: { line: number; ch: number }): void
  replaceRange(
    text: string,
    from: { line: number; ch: number },
    to: { line: number; ch: number }
  ): void
}

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
      else if (item.type === 'radio') item.checked = true
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

const exitSourceMode = async(page: Page, app: ElectronApplication): Promise<void> => {
  const inSource = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (!inSource) return
  await clickMenuOnPage(app, page, 'sourceCodeModeMenuItem')
  await page.waitForFunction(() => !document.querySelector('.source-code'), null, {
    timeout: 10000
  })
}

const selectSource = (
  page: Page,
  from: { line: number; ch: number },
  to: { line: number; ch: number }
): Promise<void> =>
  page.evaluate(
    ({ start, end }) => {
      const node = document.querySelector('.source-code .CodeMirror') as {
        CodeMirror?: SourceEditor
      } | null
      const cm = node?.CodeMirror
      if (!cm) return
      cm.focus()
      cm.setSelection(start, end)
    },
    { start: from, end: to }
  )

test.describe.serial('comment threads follow the editor', () => {
  test.describe.configure({ timeout: 90_000 })

  let app: ElectronApplication
  let page: Page
  let repoDir = ''
  let filePath = ''

  test.beforeAll(async() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-comments-'))
    execFileSync('git', ['init'], { cwd: repoDir })
    filePath = path.join(repoDir, 'guide.md')
    fs.writeFileSync(filePath, MARKDOWN)
    const launched = await launchElectron([repoDir, filePath])
    app = launched.app
    await waitForMenuReady(app)
    await expect
      .poll(async() => {
        for (const candidate of app.windows()) {
          const text = await candidate.locator('body').innerText().catch(() => '')
          if (text.includes('strict')) {
            page = candidate
            return true
          }
        }
        return false
      })
      .toBe(true)
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
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (repoDir) fs.rmSync(repoDir, { recursive: true, force: true })
  })

  test('saves a thread beside the markdown and keeps the highlight in both editors', async() => {
    await enterSourceMode(page, app)
    await selectSource(page, { line: 0, ch: 6 }, { line: 0, ch: 12 })
    await expect.poll(() => commentable(app, page)).toBe(true)

    await runCommentCommand(app, page)
    const draft = page.locator('.mt-comments .draft')
    await expect(draft).toBeVisible()
    await draft.locator('textarea').fill('look here')
    await draft.locator('button.primary').click()

    const commentsPath = path.join(repoDir, '.marktext', 'comments', 'guide.md.json')
    await expect.poll(() => fs.existsSync(commentsPath)).toBe(true)
    const stored = JSON.parse(fs.readFileSync(commentsPath, 'utf8')) as {
      threads: Array<{ anchor: { quote: string }; messages: Array<{ text: string }> }>
    }
    expect(stored.threads).toHaveLength(1)
    expect(stored.threads[0]?.anchor.quote).toBe('strict')
    expect(stored.threads[0]?.messages[0]?.text).toBe('look here')
    expect(fs.readFileSync(filePath, 'utf8')).toBe(MARKDOWN)

    await expect(page.locator('.source-code .mt-comment')).toBeVisible()
    await exitSourceMode(page, app)
    await expect(page.locator('.mu-comment')).toBeVisible()
    await enterSourceMode(page, app)
    await expect(page.locator('.source-code .mt-comment')).toBeVisible()
  })

  test('leaves comment unavailable when the selection crosses two paragraphs', async() => {
    await selectSource(page, { line: 0, ch: 0 }, { line: 2, ch: 4 })
    await expect.poll(() => commentable(app, page)).toBe(false)

    await runCommentCommand(app, page)
    await expect(page.locator('.mt-notification')).toContainText(
      /A comment can only be left|Комментарий можно оставить/
    )
    await expect(page.locator('.mt-comments .draft')).toHaveCount(0)

    const commentsPath = path.join(repoDir, '.marktext', 'comments', 'guide.md.json')
    const stored = JSON.parse(fs.readFileSync(commentsPath, 'utf8')) as { threads: unknown[] }
    expect(stored.threads).toHaveLength(1)
  })

  test('detaches the thread when the quoted text is removed', async() => {
    await page.evaluate(() => {
      const node = document.querySelector('.source-code .CodeMirror') as {
        CodeMirror?: SourceEditor
      } | null
      node?.CodeMirror?.replaceRange('loose', { line: 0, ch: 6 }, { line: 0, ch: 12 })
    })

    await expect(page.getByText(/Quote was not found|Цитата не найдена/)).toBeVisible({
      timeout: 5000
    })
    await expect(page.locator('.source-code .mt-comment')).toHaveCount(0)
  })
})
