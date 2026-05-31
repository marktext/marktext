import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  getMarkdownContent,
  launchWithMarkdown,
  placeCaretInEditor
} from './helpers'

const originalMarkdown = 'Persistent text for undo guard.\n'

const pressUndo = async(page: Page): Promise<void> => {
  await page.keyboard.press('ControlOrMeta+Z')
}

test.describe('Undo regression guards', () => {
  let app: ElectronApplication | undefined
  let page: Page

  test.afterEach(async() => {
    if (app) await app.close()
    app = undefined
  })

  test('Ctrl+Z is a no-op when the opened document has no edit history', async() => {
    const launched = await launchWithMarkdown(originalMarkdown)
    app = launched.app
    page = launched.page
    const baseline = await getMarkdownContent(page, launched.app)
    expect(baseline).toContain('Persistent text for undo guard.')

    await placeCaretInEditor(page)
    await pressUndo(page)

    await expect.poll(() => getMarkdownContent(page, launched.app)).toBe(baseline)
  })

  test('Ctrl+Z is a no-op after all edits have already been undone', async() => {
    const launched = await launchWithMarkdown(originalMarkdown)
    app = launched.app
    page = launched.page
    const baseline = await getMarkdownContent(page, launched.app)
    expect(baseline).toContain('Persistent text for undo guard.')

    await placeCaretInEditor(page)
    await page.keyboard.type(' changed', { delay: 0 })
    await expect(page.locator('.editor-component')).toContainText(' changed')

    await placeCaretInEditor(page)
    await pressUndo(page)
    await expect(page.locator('.editor-component')).toContainText('Persistent text for undo guard.')
    await expect(page.locator('.editor-component')).not.toContainText(' changed')

    await placeCaretInEditor(page)
    await pressUndo(page)
    await expect.poll(() => getMarkdownContent(page, launched.app)).toBe(baseline)
  })
})
