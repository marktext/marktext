import { expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { launchElectron } from './helpers'

test('CLI opens a named buffer without writing until Save (#2143)', async() => {
  const directory = mkdtempSync(path.join(tmpdir(), 'marktext-2143-e2e-'))
  const pathname = path.join(directory, 'first.md')
  const { app, page } = await launchElectron([pathname], {
    preferences: { openFilesInNewWindow: false, autoSave: false, tabBarVisibility: true }
  })
  try {
    await expect(page.locator('.tabs-container > li').filter({ hasText: 'first.md' })).toHaveCount(
      1
    )
    expect(existsSync(pathname)).toBe(false)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('mt::editor-ask-file-save')
    })
    await expect.poll(() => existsSync(pathname)).toBe(true)
    expect(readFileSync(pathname, 'utf8')).toBe('')

    if (process.platform === 'darwin') {
      await app.evaluate(({ app, BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].minimize()
        if (process.platform === 'darwin') app.hide()
      })
      await expect
        .poll(() =>
          app.evaluate(({ app, BrowserWindow }) => ({
            minimized: BrowserWindow.getAllWindows()[0].isMinimized(),
            hidden: process.platform === 'darwin' && app.isHidden()
          }))
        )
        .toEqual({ minimized: true, hidden: process.platform === 'darwin' })
    }
    await app.evaluate(({ app }, workingDirectory) => {
      const argv = ['marktext', 'second.md']
      app.emit('second-instance', {}, argv, workingDirectory, { argv })
    }, directory)
    await expect(page.locator('.tabs-container > li').filter({ hasText: 'second.md' })).toHaveCount(
      1
    )
    expect(existsSync(path.join(directory, 'second.md'))).toBe(false)
    if (process.platform === 'darwin') {
      await expect
        .poll(() =>
          app.evaluate(({ app, BrowserWindow }) => ({
            minimized: BrowserWindow.getAllWindows()[0].isMinimized(),
            hidden: process.platform === 'darwin' && app.isHidden(),
            active: process.platform !== 'darwin' || app.isActive()
          }))
        )
        .toEqual({ minimized: false, hidden: false, active: true })
    }
    await app.evaluate(({ app }, workingDirectory) => {
      const argv = ['marktext', 'second.md']
      app.emit('second-instance', {}, argv, workingDirectory, { argv })
    }, directory)
    await expect(page.locator('.tabs-container > li').filter({ hasText: 'second.md' })).toHaveCount(
      1
    )
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('mt::editor-close-tab')
    })
    await expect(page.locator('.tabs-container > li').filter({ hasText: 'second.md' })).toHaveCount(
      0
    )
    expect(existsSync(path.join(directory, 'second.md'))).toBe(false)

    await app.evaluate(({ app }, workingDirectory) => {
      const argv = ['marktext', '--new-window', 'third.md']
      app.emit('second-instance', {}, argv, workingDirectory, { argv })
    }, directory)
    await expect.poll(() => app.windows().length).toBe(2)
    const newPage = app.windows().find((window) => window !== page)
    if (!newPage) throw new Error('Expected a new editor window')
    await expect(
      newPage.locator('.tabs-container > li').filter({ hasText: 'third.md' })
    ).toHaveCount(1)
    const thirdPath = path.join(directory, 'third.md')
    expect(existsSync(thirdPath)).toBe(false)
    writeFileSync(thirdPath, 'external content')
    await app.evaluate(({ dialog }) => {
      const state = globalThis as typeof globalThis & { confirmations: number }
      state.confirmations = 0
      dialog.showMessageBox = async() => {
        state.confirmations++
        return { response: 1, checkboxChecked: false }
      }
    })
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getTitle().includes('third.md')
      )
      win?.webContents.send('mt::editor-ask-file-save')
    })
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as typeof globalThis & { confirmations: number }).confirmations
        )
      )
      .toBe(1)
    expect(readFileSync(thirdPath, 'utf8')).toBe('external content')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
