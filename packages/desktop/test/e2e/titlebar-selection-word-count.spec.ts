import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  enterSourceMode,
  exitSourceMode,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  sendIpcToRenderer
} from './helpers'

const DOC = 'Alpha beta gamma\n\nDelta epsilon\n'
const TABLE_DOC = ['| a1 | b1 |', '| --- | --- |', '| a2 | b2 |', ''].join('\n')

const selectAllSourceText = async(page: Page): Promise<void> => {
  await page.click('.source-code .CodeMirror')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
}

const clearSourceSelection = async(page: Page): Promise<void> => {
  await page.keyboard.press('ArrowRight')
}

// The engine reports a selection when the drag is released, so every assertion
// below waits for the released state rather than an intermediate one.
const dragAcrossParagraphs = async(page: Page, from: number, to: number): Promise<void> => {
  const paragraphs = page.locator('p.mu-paragraph')
  const start = await paragraphs.nth(from).boundingBox()
  const end = await paragraphs.nth(to).boundingBox()
  if (!start || !end) throw new Error('paragraphs not found')

  await page.mouse.move(start.x + 1, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width - 1, end.y + end.height / 2, { steps: 8 })
  await page.mouse.up()
}

const dragSelectTableCells = async(page: Page): Promise<void> => {
  const cells = page.locator('td.mu-table-cell')
  const first = await cells.nth(0).boundingBox()
  const second = await cells.nth(1).boundingBox()
  if (!first || !second) throw new Error('table cells not found')

  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.describe('Title bar selection word count', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(DOC, {
      suppressErrorDialog: true,
      preferences: { language: 'en' }
    })
    app = launched.app
    page = launched.page
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('shows selected count first and document count second', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('Words 5')

    await dragAcrossParagraphs(page, 0, 0)
    await expect(counter).toHaveText('Words 3 / 5')

    await counter.hover()
    const panel = page.locator('.document-statistics-popover').last()
    await expect(panel).toBeVisible()
    await expect(panel.locator('.document-statistics__value').nth(0)).toHaveText('3 / 5')
    await expect(panel.locator('.document-statistics__value').nth(1)).toHaveText('14 / 26')
    await expect(panel.locator('.document-statistics__value').nth(3)).toHaveText('16 / 32')

    await placeCaretInEditor(page)
    await expect(counter).toHaveText('Words 5')
    await expectNoRendererErrors(app)
  })

  test('counts a selection spanning several paragraphs', async() => {
    const counter = page.locator('.word-count')

    await dragAcrossParagraphs(page, 0, 1)
    await expect(counter).toHaveText('Words 5 / 5')

    await counter.hover()
    const panel = page.locator('.document-statistics-popover').last()
    await expect(panel.locator('.document-statistics__value').nth(2)).toHaveText('2 / 2')
    await expect(panel.locator('.document-statistics__value').nth(3)).toHaveText('31 / 32')
    await expectNoRendererErrors(app)
  })

  test('grows the selected count with Shift+arrow across blocks', async() => {
    const counter = page.locator('.word-count')

    await placeCaretInEditor(page)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown')
    await expect(counter).toHaveText('Words 5 / 5')

    await page.keyboard.press('ArrowRight')
    await expect(counter).toHaveText('Words 5')
    await expectNoRendererErrors(app)
  })

  test('restores the count with the saved selection when returning to a tab', async() => {
    const counter = page.locator('.word-count')

    await dragAcrossParagraphs(page, 0, 0)
    await expect(counter).toHaveText('Words 3 / 5')

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Alpha beta gamma\n')
    await expect(counter).toHaveText('Words 3')

    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(
      'Alpha beta gamma'
    )
    await expect(counter).toHaveText('Words 3 / 5')

    await placeCaretInEditor(page)
    await expect(counter).toHaveText('Words 5')
    await expectNoRendererErrors(app)
  })

  test('shows and clears selected count in source-code mode', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('Words 5')

    await enterSourceMode(page, app)
    await expect(counter).toHaveText('Words 5')

    await selectAllSourceText(page)
    await expect(counter).toHaveText('Words 5 / 5')

    await clearSourceSelection(page)
    await expect(counter).toHaveText('Words 5')
    await expectNoRendererErrors(app)
  })

  test('preserves selected count after leaving source-code mode', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('Words 5')

    await enterSourceMode(page, app)
    await selectAllSourceText(page)
    await expect(counter).toHaveText('Words 5 / 5')

    await exitSourceMode(page, app)
    await expect(counter).toHaveText('Words 5 / 5')
    await placeCaretInEditor(page)
    await expect(counter).toHaveText('Words 5')
    await expectNoRendererErrors(app)
  })

  test('restores source-code selected count after tab switch clears it', async() => {
    const counter = page.locator('.word-count')

    await enterSourceMode(page, app)
    await selectAllSourceText(page)
    await expect(counter).toHaveText('Words 5 / 5')

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Alpha beta gamma\n')
    await expect(counter).toHaveText('Words 3')

    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect(counter).toHaveText('Words 5 / 5')
    await expectNoRendererErrors(app)
  })
})

// A frozen rectangular table selection drops the native range, which is what
// the engine reads, so it contributes no selected count. Pinned here so the
// Selection rework has to decide about it deliberately.
test('shows no selected count for a rectangular table selection', async() => {
  const { app, page } = await launchWithMarkdown(TABLE_DOC, {
    suppressErrorDialog: true,
    preferences: { language: 'en' }
  })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText(/^Words\s+\d+$/)

    await dragSelectTableCells(page)
    await expect(counter).toHaveText(/^Words\s+\d+$/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
