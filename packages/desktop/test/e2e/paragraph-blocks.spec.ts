import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  launchWithDoc,
  clickMenuById,
  setSourceMarkdown,
  placeCaretInEditor,
  enterSourceMode,
  exitSourceMode,
  getMarkdownContent
} from './helpers'

const resetTo = async(page: Page, app: ElectronApplication, text: string) => {
  await setSourceMarkdown(page, app, text + '\n')
  await placeCaretInEditor(page)
}

test.describe('Paragraph block transforms', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed paragraph\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    await resetTo(page, app, 'sample text')
  })

  test('Heading 1', async() => {
    await clickMenuById(app, 'heading1MenuItem')
    await page.waitForSelector('.editor-component h1', { state: 'attached', timeout: 5000 })
  })

  test('Heading 2', async() => {
    await clickMenuById(app, 'heading2MenuItem')
    await page.waitForSelector('.editor-component h2', { state: 'attached', timeout: 5000 })
  })

  test('Heading 3', async() => {
    await clickMenuById(app, 'heading3MenuItem')
    await page.waitForSelector('.editor-component h3', { state: 'attached', timeout: 5000 })
  })

  test('Bullet list', async() => {
    await clickMenuById(app, 'bulletListMenuItem')
    await page.waitForSelector('.editor-component ul li', { state: 'attached', timeout: 5000 })
  })

  test('Ordered list', async() => {
    await clickMenuById(app, 'orderListMenuItem')
    await page.waitForSelector('.editor-component ol li', { state: 'attached', timeout: 5000 })
  })

  test('Task list', async() => {
    await clickMenuById(app, 'taskListMenuItem')
    await page.waitForSelector('.editor-component input[type="checkbox"]', {
      state: 'attached',
      timeout: 5000
    })
  })

  test('Block quote', async() => {
    await clickMenuById(app, 'quoteBlockMenuItem')
    await page.waitForSelector('.editor-component blockquote', { state: 'attached', timeout: 5000 })
  })

  test('Code fence', async() => {
    await clickMenuById(app, 'codeFencesMenuItem')
    const present = await page
      .locator('.editor-component pre, .editor-component .mu-code-block')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(present).toBe(true)
  })

  // HR + table require Muya to act on a live cursor inside an empty paragraph
  // (isAllowedTransformation in paragraphCtrl.js gates them on !block.text).
  // Driving that state purely from outside the renderer is not reliable on
  // xvfb — the menu invocation reaches Muya but Muya's contentState.cursor
  // is not pointing at an empty block. Skip until Muya exposes a test hook;
  // smoke-coverage that the menu id exists is in menu-sanity.spec.js.
  test.skip('Horizontal rule', async() => {
    await resetTo(page, app, '')
    await clickMenuById(app, 'horizontalLineMenuItem')
    const present = await page
      .locator('.editor-component hr, .editor-component figure[data-role="HR"]')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(present).toBe(true)
  })

  test('Math block', async() => {
    await clickMenuById(app, 'mathBlockMenuItem')
    const ok = await page
      .locator('.editor-component .mu-math-block, .editor-component figure.mu-math-block')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(ok).toBe(true)
  })

  test('HTML block', async() => {
    await clickMenuById(app, 'htmlBlockMenuItem')
    const ok = await page
      .locator('.editor-component .mu-html-block, .editor-component figure.mu-html-block')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(ok).toBe(true)
  })

  test.skip('Insert table dialog opens and accepts default', async() => {
    // Same constraint as HR — needs empty paragraph + live cursor in Muya.
    await resetTo(page, app, '')
    await clickMenuById(app, 'tableMenuItem')
    const dialog = page.locator('.ag-dialog-table, .el-overlay').first()
    const dialogVisible = await dialog
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(dialogVisible).toBe(true)
    // Confirm default 3x3 by pressing Enter.
    await page.keyboard.press('Enter')
    const tableAppeared = await page
      .locator('.editor-component table')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(tableAppeared).toBe(true)
  })
})

// Item 73 — the desktop createTable wiring: clicking the Paragraph › Table
// menu item must open the el-dialog table picker, and confirming it must drive
// the renderer's `editor.createTable(tableChecker)` (editor.vue
// handleDialogTableConfirm) through to a real @muyajs/core table whose caret
// lands in a cell. The previously-skipped test above could not be trusted
// because Muya needed a live cursor in an empty paragraph; the
// placeCaretInEditor helper now seeds the engine's activeContentBlock (via a
// synthetic keyup on the editor root), which `_immediateBlockAtCursor` reads —
// so the insert survives the dialog stealing DOM focus.
test.describe('Insert table dialog (item 73)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed paragraph\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('opens the picker dialog, confirms, and inserts the 4x3 default table', async() => {
    // Start from an empty paragraph with a live engine cursor in it.
    await setSourceMarkdown(page, app, '\n')
    await placeCaretInEditor(page)

    // Paragraph › Table → main sends mt::editor-paragraph-action {type:'table'}
    // → renderer bus 'paragraph' → handleEditParagraph opens the dialog and
    // seeds tableChecker to rows=4, columns=3.
    await clickMenuById(app, 'tableMenuItem')

    const dialog = page.locator('.ag-insert-table-dialog')
    await dialog.waitFor({ state: 'visible', timeout: 5000 })
    await expect(dialog).toBeVisible()

    // The seeded default shape is 4 rows x 3 columns.
    const rows = await dialog.locator('.el-input-number input').first().inputValue()
    expect(rows).toBe('4')

    // Confirm via the primary OK button (handleDialogTableConfirm →
    // editor.createTable(tableChecker)).
    await dialog.locator('.el-button--primary').click()
    await dialog.waitFor({ state: 'hidden', timeout: 5000 })

    // A real table renders. The engine emits rows directly under <table> and
    // every cell as td.mu-table-cell (no thead/tbody, no th). The 4x3 default
    // therefore yields 4 rows x 3 = 12 cells.
    await page.waitForSelector('.editor-component table', { state: 'attached', timeout: 5000 })
    await expect
      .poll(() => page.locator('.editor-component table td').count(), { timeout: 5000 })
      .toBe(12)
    const rowCount = await page.locator('.editor-component table tr').count()
    expect(rowCount).toBe(4)

    // The caret lands inside a table cell (createTable calls setCursor on the
    // first content descendant of the new table).
    const caretInCell = await page.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return false
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.closest('td.mu-table-cell')) return true
        node = node.parentNode
      }
      return false
    })
    expect(caretInCell).toBe(true)
  })
})

// Item 89 — desktop source-mode round-trip for a GFM table with mixed column
// alignment. No prior desktop spec consumed a mixed-alignment table fixture;
// fixture-render.spec.ts only asserts the table RENDERS (cell count), never the
// source-mode round-trip or that the :--- / :--: / ---: alignment markers
// survive the WYSIWYG → source toggle. The muya serializer normalises delimiter
// column widths, so we assert the alignment MARKERS survive (left/center/right)
// rather than byte-for-byte equality. We then edit a cell and assert the tab
// picks up the unsaved/modified indicator.
test.describe('Table source-mode round-trip + modified indicator (item 89)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithDoc('test/e2e/data/table.md')
    app = launched.app
    page = launched.page
    // Let Muya finish rendering the table blocks.
    await page.waitForSelector('.editor-component table', { state: 'attached', timeout: 10000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('source mode preserves the left/center/right alignment markers', async() => {
    await enterSourceMode(page, app)
    const md = await page.evaluate(() => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: { getValue(): string } })
        | null
      return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : ''
    })
    await exitSourceMode(page, app)

    // The delimiter row is the table's second line. The fixture declares
    // :--- (left), :--: (center), ----: (right). Desktop source mode shows the
    // document markdown, so all three alignment markers must round-trip.
    const delimiterRow = md.split('\n').find((line) => /^\s*\|\s*:?-+/.test(line)) ?? ''
    expect(delimiterRow).not.toBe('')

    // Match each alignment marker as a standalone delimiter cell (tolerant of
    // the surrounding pipes/whitespace and of any serializer column-width
    // normalisation): left → :---, center → :--:, right → ---:.
    expect(delimiterRow).toMatch(/\|\s*:-+\s*\|/) // left: leading colon only
    expect(delimiterRow).toMatch(/\|\s*:-+:\s*\|/) // center: both colons
    expect(delimiterRow).toMatch(/\|\s*-+:\s*\|/) // right: trailing colon only

    // The header/body content also round-trips intact.
    expect(md).toContain('Name')
    expect(md).toContain('Score')
    expect(md).toContain('Ada')
  })

  test('editing a table cell marks the tab as unsaved', async() => {
    // Sanity: a freshly loaded file starts clean.
    expect(
      await page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))
    ).toBe(false)

    // Click into the first table cell so the engine's active block is a cell,
    // then type into it.
    const firstCell = page.locator('.editor-component table td.mu-table-cell').first()
    await firstCell.click()
    await page.waitForTimeout(150)
    await page.keyboard.type('X', { delay: 0 })

    // The edit dirties the tab; poll because the indicator flips on the
    // async json-change.
    await expect
      .poll(
        () => page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved')),
        { timeout: 5000 }
      )
      .toBe(true)

    // The modified content is observable through the source-mode round-trip.
    const md = await getMarkdownContent(page, app)
    expect(md).toContain('X')
  })
})
