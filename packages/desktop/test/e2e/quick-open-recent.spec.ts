import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { expectNoRendererErrors, launchWithMarkdown, sendIpcToRenderer } from './helpers'

test('quick open lists recent files and the recent picker opens, filters and removes them (#1609)', async() => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recent-folder-'))
  const folderName = path.basename(folder)
  const launched = await launchWithMarkdown('# Recent\n', {
    suppressErrorDialog: true,
    preferences: { language: 'en', openFolderInNewWindow: false },
    userDataFiles: {
      'recently-used-documents.json': JSON.stringify([folder])
    }
  })
  const { app, page, filePath } = launched
  const name = path.basename(filePath)

  try {
    await page.waitForTimeout(500)

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open')
    const quickInput = page.locator('input.search:visible').first()
    await expect(quickInput).toHaveAttribute('placeholder', 'Search file to open')
    await expect(page.locator('.commands .group-header').first()).toHaveText('recently opened')
    await expect(
      page.locator('.commands li.command-item').filter({ hasText: name })
    ).toHaveCount(1)
    await quickInput.press('Escape')
    await expect(page.locator('input.search:visible')).toHaveCount(0)

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open-recent')
    const recentInput = page.locator('input.search:visible').first()
    await expect(recentInput).toHaveAttribute('placeholder', 'Search recent files and folders')
    await expect(page.locator('.commands .group-header').first()).toHaveText('folders')

    const folderItem = page.locator('.commands li.command-item').filter({ hasText: folderName })
    await expect(folderItem).toHaveCount(1)
    await folderItem.click()
    await expect(page.locator('.project-root')).toHaveCount(1)
    await expect(page.locator('.project-root')).toContainText(folderName)
    expect(app.windows()).toHaveLength(1)
    await expect(page.locator('input.search:visible')).toHaveCount(0)

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open-recent')
    const reopenedInput = page.locator('input.search:visible').first()
    await expect(reopenedInput).toHaveAttribute('placeholder', 'Search recent files and folders')

    const recentItem = page.locator('.commands li.command-item').filter({ hasText: name })
    await expect(recentItem).toHaveCount(1)

    await reopenedInput.pressSequentially(name.slice(0, 4))
    await expect(page.locator('.commands li.command-item')).toHaveCount(1)

    await recentItem.locator('button.remove').click()
    await expect(page.locator('.commands li.command-item')).toHaveCount(0)
    await expect(page.locator('.no-results')).toHaveText('No matching results')
    await expect(reopenedInput).toBeFocused()
    await page.keyboard.type('hello')
    await expect(reopenedInput).toHaveValue(`${name.slice(0, 4)}hello`)
    await reopenedInput.press('Escape')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
