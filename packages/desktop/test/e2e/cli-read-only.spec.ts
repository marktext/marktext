import { expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  launchElectron,
  launchWithMarkdown,
  sendIpcToRenderer,
  typeIntoEditor,
  waitForEditor,
  waitForMenuReady
} from './helpers'

test('--read-only opens every CLI file in reading mode without writing', async() => {
  const directory = mkdtempSync(path.join(tmpdir(), 'marktext-cli-read-only-'))
  const firstPath = path.join(directory, 'first.md')
  const secondPath = path.join(directory, 'second.md')
  writeFileSync(firstPath, 'first\n')
  writeFileSync(secondPath, 'second\n')
  const { app, page } = await launchElectron(['--read-only', firstPath, secondPath], {
    preferences: {
      autoSave: true,
      autoSaveDelay: 1000,
      openFilesInNewWindow: false,
      tabBarVisibility: true
    }
  })
  try {
    await waitForEditor(page)
    await waitForMenuReady(app)
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await expect(page.locator('.mu-read-only')).toBeVisible()

    await page.locator('.mu-paragraph .mu-content').first().click()
    await page.keyboard.type('blocked')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await page.waitForTimeout(1200)
    expect(readFileSync(firstPath, 'utf8')).toBe('first\n')
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
    await expect
      .poll(() =>
        app.evaluate(
          ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('readOnlyModeMenuItem')?.checked
        )
      )
      .toBe(true)

    await page.locator('.tabs-container > li').filter({ hasText: 'second.md' }).click()
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.editor-component')).toContainText('second')

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'editable\n')
    await expect(page.locator('.mu-read-only')).toHaveCount(0)
    await typeIntoEditor(page, ' editable')
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(1)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    rmSync(directory, { recursive: true, force: true })
  }
})

test('--read-only locks an existing writable tab without dropping its dirty buffer', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n', {
    preferences: { tabBarVisibility: true }
  })
  try {
    await typeIntoEditor(page, ' retained edit')
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(1)

    await app.evaluate(
      ({ app }, payload) => {
        app.emit('second-instance', {}, payload.argv, payload.workingDirectory, {
          argv: payload.argv
        })
      },
      {
        argv: ['marktext', '--read-only', path.basename(filePath)],
        workingDirectory: path.dirname(filePath)
      }
    )

    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container > li')).toHaveCount(1)
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(1)
    await expect(page.locator('.editor-component')).toContainText('retained edit')

    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await page.waitForTimeout(200)
    expect(readFileSync(filePath, 'utf8')).toBe('original\n')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('--new-window --read-only combines both options on second-instance', async() => {
  const { app, page, filePath } = await launchWithMarkdown('first\n')
  const secondPath = path.join(path.dirname(filePath), 'second.md')
  writeFileSync(secondPath, 'second\n')
  try {
    await app.evaluate(
      ({ app }, payload) => {
        app.emit('second-instance', {}, payload.argv, payload.workingDirectory, {
          argv: payload.argv
        })
      },
      {
        argv: ['marktext', '--new-window', '--read-only', 'second.md'],
        workingDirectory: path.dirname(filePath)
      }
    )

    await expect.poll(() => app.windows().length).toBe(2)
    const secondPage = app.windows().find((window) => window !== page)
    if (!secondPage) throw new Error('Expected a new editor window')
    await waitForEditor(secondPage)
    await expect(secondPage.locator('.mu-read-only')).toBeVisible()
    await expect(secondPage.locator('.tabs-container > li')).toHaveCount(1)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('--read-only does not create a named buffer for a missing file', async() => {
  const directory = mkdtempSync(path.join(tmpdir(), 'marktext-cli-read-only-missing-'))
  const missingPath = path.join(directory, 'missing.md')
  const { app, page } = await launchElectron(['--read-only', missingPath], {
    preferences: { startUpAction: 'blank' }
  })
  try {
    await waitForMenuReady(app)
    await expect(page.locator('.tabs-container > li')).toHaveCount(0)
    expect(existsSync(missingPath)).toBe(false)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    rmSync(directory, { recursive: true, force: true })
  }
})
