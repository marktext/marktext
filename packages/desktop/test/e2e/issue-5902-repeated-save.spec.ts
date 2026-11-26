import { expect, test } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  getMarkdownContent,
  launchElectron,
  sendIpcToRenderer,
  typeIntoEditor,
  waitForEditor,
  waitForMenuReady
} from './helpers'

test('keeps dirty text after a delayed repeat of the last auto-save', async() => {
  const testInfo = test.info()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-5902-'))
  const pathname = path.join(root, 'notes.md')
  fs.writeFileSync(pathname, 'Original paragraph.\n')
  const { app, page } = await launchElectron([pathname], {
    preferences: { language: 'en', autoSave: true, autoSaveDelay: 1000 }
  })
  try {
    await waitForEditor(page)
    await waitForMenuReady(app)
    await typeIntoEditor(page, 'saved change')
    await expect.poll(() => fs.readFileSync(pathname, 'utf8')).toContain('saved change')
    await expect(page.locator('.title-bar .title .save-dot')).not.toHaveClass(/show/)
    const savedBytes = fs.readFileSync(pathname)

    // Leave time for the watcher to deliver a delayed repeat before the next auto-save.
    await sendIpcToRenderer(app, 'mt::user-preference', { autoSaveDelay: 30000 })
    await typeIntoEditor(page, ' later edits')
    await expect(page.locator('.title-bar .title .save-dot')).toHaveClass(/show/)
    const dirtyMarkdown = await getMarkdownContent(page, app)
    await page.evaluate(() => {
      const state = window as Window & { repeatedSaveEvents?: number }
      state.repeatedSaveEvents = 0
      window.electron.ipcRenderer.on('mt::update-file', () => {
        state.repeatedSaveEvents = (state.repeatedSaveEvents ?? 0) + 1
      })
    })

    await page.waitForTimeout(1600)
    fs.writeFileSync(pathname, savedBytes)
    await page.waitForFunction(() =>
      ((window as Window & { repeatedSaveEvents?: number }).repeatedSaveEvents ?? 0) > 0
    )

    const reloadPrompt = page.getByText(/has been changed on disk/)
    await expect(reloadPrompt).not.toBeVisible()
    expect(await getMarkdownContent(page, app)).toBe(dirtyMarkdown)
    await expect(page.locator('.title-bar .title .save-dot')).toHaveClass(/show/)
    expect(fs.readFileSync(pathname)).toEqual(savedBytes)
    await testInfo.attach('repeated-save-keeps-later-edits', {
      body: await page.screenshot({ path: testInfo.outputPath('repeated-save.png') }),
      contentType: 'image/png'
    })

    fs.writeFileSync(pathname, 'A genuinely different external edit.\n')
    await expect(reloadPrompt).toBeVisible()
    expect(await getMarkdownContent(page, app)).toBe(dirtyMarkdown)
    await testInfo.attach('different-external-edit-still-prompts', {
      body: await page.screenshot({ path: testInfo.outputPath('external-edit.png') }),
      contentType: 'image/png'
    })
  } finally {
    await app.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})
