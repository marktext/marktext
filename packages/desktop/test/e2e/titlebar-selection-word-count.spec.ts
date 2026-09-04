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
const INLINE_MATH_DOC = '$E = mc^2$\n'
const TABLE_DOC = [
  '| a1 | b1 | c1 |',
  '| --- | --- | --- |',
  '| a2 | b2 | c2 |',
  '| a3 | b3 | c3 |',
  ''
].join('\n')
const HEADER_TABLE_DOC = [
  '| Name | Formula | Description |',
  '| --- | --- | --- |',
  '| alpha beta | $y=x$ | first row words |',
  '| gamma delta | $E=mc^2$ | second row words |',
  ''
].join('\n')
const MIXED_TABLE_DOC = [
  '| Name | Formula | Mixed | Markup |',
  '| --- | --- | --- | --- |',
  '| alpha beta | $y=x$ | 中文 测试 | **bold words** |',
  '| gamma delta | $E = mc^2$ | `inline code` | [link text](https://example.com) |',
  '| punctuation ! ? | $a^2+b^2=c^2$ | mixed 中文 alpha | _italic words_ |',
  ''
].join('\n')

const selectAllSourceText = async(page: Page): Promise<void> => {
  await page.click('.source-code .CodeMirror')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
}

const clearSourceSelection = async(page: Page): Promise<void> => {
  await page.keyboard.press('ArrowRight')
}

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

const dragSelectInlineMathParagraph = async(page: Page): Promise<void> => {
  const paragraph = page.locator('p.mu-paragraph')
  const box = await paragraph.boundingBox()
  if (!box) throw new Error('inline math paragraph not found')

  await page.mouse.move(box.x + 1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
}

const dragSelectTableCells = async(page: Page): Promise<void> => {
  const cells = page.locator('td.mu-table-cell')
  const first = await cells.nth(0).boundingBox()
  const fourth = await cells.nth(4).boundingBox()
  if (!first || !fourth) throw new Error('table cells not found')

  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(fourth.x + fourth.width / 2, fourth.y + fourth.height / 2)
  await page.mouse.up()
}

const pressTableCell = async(page: Page): Promise<void> => {
  const cell = page.locator('td.mu-table-cell').filter({ hasText: 'b2' }).first()
  const box = await cell.boundingBox()
  if (!box) throw new Error('table cell not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
}

const dragBackToTableHeader = async(page: Page, targetHeader: string): Promise<void> => {
  const name = page.locator('.mu-table-cell').filter({ hasText: 'Name' }).first()
  const alpha = page.locator('.mu-table-cell').filter({ hasText: 'alpha beta' }).first()
  const target = page.locator('.mu-table-cell').filter({ hasText: targetHeader }).first()
  const nameBox = await name.boundingBox()
  const alphaBox = await alpha.boundingBox()
  const targetBox = await target.boundingBox()
  if (!nameBox || !alphaBox || !targetBox) throw new Error('table cells not found')

  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(alphaBox.x + alphaBox.width / 2, alphaBox.y + alphaBox.height / 2, { steps: 8 })
  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2, { steps: 8 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 })
  await page.mouse.up()
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
    const tooltip = page.locator('.word-count-tooltip').filter({ hasText: '5 / 3' }).last()
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

  test('shows and clears selected count in source-code mode', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('W 5')

    await enterSourceMode(page, app)
    await expect(counter).toHaveText('W 5')

    await selectAllSourceText(page)
    await expect(counter).toHaveText('W 5 / 5')

    await clearSourceSelection(page)
    await expect(counter).toHaveText('W 5')
    await expectNoRendererErrors(app)
  })

  test('preserves selected count after leaving source-code mode', async() => {
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('W 5')

    await enterSourceMode(page, app)
    await selectAllSourceText(page)
    await expect(counter).toHaveText('W 5 / 5')

    await exitSourceMode(page, app)
    await expect(counter).toHaveText('W 5 / 5')
    await placeCaretInEditor(page)
    await expect(counter).toHaveText('W 5')
    await expectNoRendererErrors(app)
  })

  test('restores source-code selected count after tab switch clears it', async() => {
    const counter = page.locator('.word-count')

    await enterSourceMode(page, app)
    await selectAllSourceText(page)
    await expect(counter).toHaveText('W 5 / 5')

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Alpha beta gamma\n')
    await expect(counter).toHaveText('W 3')

    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect(counter).toHaveText('W 5 / 5')
    await expectNoRendererErrors(app)
  })
})

test('shows selected count for table rectangular selection', async() => {
  const { app, page } = await launchWithMarkdown(TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')

    await dragSelectTableCells(page)
    await expect(counter).toHaveText(/\/ 4$/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('updates table selected count when dragging back to the original header cell', async() => {
  const { app, page } = await launchWithMarkdown(HEADER_TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')

    await dragBackToTableHeader(page, 'Name')
    await expect(counter).toHaveText(/\/ 1$/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('updates table selected count when dragging back across the header row', async() => {
  const { app, page } = await launchWithMarkdown(HEADER_TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')

    await dragBackToTableHeader(page, 'Formula')
    await expect(counter).toHaveText(/\/ 2$/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('does not show selected count while pressing a table cell', async() => {
  const { app, page } = await launchWithMarkdown(TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText(/^W \d+$/)
    const initialCount = await counter.textContent()
    if (!initialCount) throw new Error('word count not found')

    await pressTableCell(page)
    await expect(counter).toHaveText(initialCount)
    await expect(counter).toHaveText(/^W \d+$/)
    await page.mouse.up()
    await expect(counter).toHaveText(initialCount)
    await expect(counter).toHaveText(/^W \d+$/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('updates table selected count without native selectionchange fallback', async() => {
  const { app, page } = await launchWithMarkdown(HEADER_TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    await page.evaluate(() => {
      document.addEventListener('selectionchange', event => event.stopImmediatePropagation(), true)
    })
    const counter = page.locator('.word-count')
    const cells = page.locator('.mu-table-cell')
    const nameBox = await cells.nth(0).boundingBox()
    const formulaBox = await cells.nth(1).boundingBox()
    const alphaBox = await cells.nth(3).boundingBox()
    if (!nameBox || !formulaBox || !alphaBox) throw new Error('table cells not found')

    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(alphaBox.x + alphaBox.width / 2, alphaBox.y + alphaBox.height / 2, { steps: 8 })
    await expect(counter).toHaveText(/\/ 3$/)
    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2, { steps: 8 })
    await expect(counter).toHaveText(/\/ 1$/)
    await page.mouse.move(formulaBox.x + formulaBox.width / 2, formulaBox.y + formulaBox.height / 2, { steps: 8 })
    await expect(counter).toHaveText(/\/ 2$/)
    await page.mouse.up()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('counts mixed table content without native selectionchange fallback', async() => {
  const { app, page } = await launchWithMarkdown(MIXED_TABLE_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    await page.evaluate(() => {
      document.addEventListener('selectionchange', event => event.stopImmediatePropagation(), true)
    })
    const counter = page.locator('.word-count')
    const cells = page.locator('.mu-table-cell')
    const nameBox = await cells.nth(0).boundingBox()
    const markupBox = await cells.nth(15).boundingBox()
    if (!nameBox || !markupBox) throw new Error('table cells not found')

    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(markupBox.x + markupBox.width / 2, markupBox.y + markupBox.height / 2, { steps: 12 })
    await expect(counter).toHaveText(/\/ 32$/)
    await page.mouse.up()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('uses markdown source text when selecting inline math', async() => {
  const { app, page } = await launchWithMarkdown(INLINE_MATH_DOC, { suppressErrorDialog: true })
  try {
    await clearRendererErrors(app)
    const counter = page.locator('.word-count')
    await expect(counter).toHaveText('W 3')

    await dragSelectInlineMathParagraph(page)
    await expect(counter).toHaveText('W 3 / 3')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
