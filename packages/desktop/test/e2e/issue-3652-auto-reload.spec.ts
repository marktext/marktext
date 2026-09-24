import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { launchWithMarkdown, typeIntoEditor } from './helpers'

// #3652 — MarkText open beside another editor. A tab the user never edited
// discards nothing when it reloads, so it reloads silently; a tab holding
// unsaved edits must still ask before those edits are thrown away.
//
// Both cases drive the REAL watcher by writing the file on disk.

const isDirty = (page: Page) =>
  page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))

const editorText = (page: Page) =>
  page.evaluate(() => document.querySelector('.editor-component')?.textContent ?? '')

const reloadBannerText = (page: Page) =>
  page.evaluate(
    () => document.querySelector('.editor-notifications .msg')?.textContent ?? ''
  )

test.describe('Issue #3652 — reloading a file changed on disk', () => {
  test('a tab with no local edits reloads without asking', async() => {
    const { app, page, filePath } = await launchWithMarkdown('from marktext\n')
    await page.waitForTimeout(500)

    fs.writeFileSync(filePath, 'from another editor\n', 'utf-8')
    await expect.poll(() => editorText(page), { timeout: 8000 }).toContain(
      'from another editor'
    )

    expect(await isDirty(page)).toBe(false)
    expect(await reloadBannerText(page)).toBe('')

    await app.close()
  })

  test('a tab with unsaved edits asks before discarding them', async() => {
    const { app, page, filePath } = await launchWithMarkdown('from marktext\n')
    await page.waitForTimeout(500)

    await typeIntoEditor(page, ' edited here')
    await expect.poll(() => isDirty(page), { timeout: 8000 }).toBe(true)

    // The banner text is localized, so match on the filename it interpolates.
    fs.writeFileSync(filePath, 'from another editor\n', 'utf-8')
    await expect.poll(() => reloadBannerText(page), { timeout: 8000 }).toContain(
      path.basename(filePath)
    )

    expect(await editorText(page)).toContain('edited here')

    await app.close()
  })
})
