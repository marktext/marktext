import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  sendIpcToRenderer
} from './helpers'

const DOC = 'Alpha beta gamma\n\nDelta epsilon\n'

const selectFirstParagraph = async(page: Page): Promise<void> => {
  await page.evaluate(() => {
    const root = document.querySelector('.editor-component') as HTMLElement | null
    const paragraph = root?.querySelector('p.mu-paragraph') as HTMLElement | null
    if (!root || !paragraph) return

    root.focus()
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
  })
}

test.describe('Title bar selection word count', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('shows document count first and selected count second', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('W 5')

    await selectFirstParagraph(page)
    await expect(counter).toHaveText('W 5 / 3')

    await counter.hover()
    const tooltip = page.locator('.el-popper').filter({ hasText: '5 / 3' }).last()
    await expect(tooltip).toContainText('5 / 3')

    await placeCaretInEditor(page)
    await expect(counter).toHaveText('W 5')
    await expectNoRendererErrors(app)
  })

  test('restores the same selected count after tab switch clears it', async() => {
    const counter = page.locator('.word-count')

    await selectFirstParagraph(page)
    await expect(counter).toHaveText('W 5 / 3')

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Alpha beta gamma\n')
    await expect(counter).toHaveText('W 3')

    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect(counter).toHaveText('W 5')

    await selectFirstParagraph(page)
    await expect(counter).toHaveText('W 5 / 3')
    await expectNoRendererErrors(app)
  })
})
