import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  clickMenuById,
  setSourceMarkdown,
  placeCaretInEditor
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
      .locator('.editor-component pre, .editor-component .ag-code-block')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(present).toBe(true)
  })

  // HR + table require Muya to act on a live cursor inside an empty paragraph
  // (isAllowedTransformation in paragraphCtrl.js gates them on !block.text).
  // Starting from an empty paragraph ensures block.text === '' so the
  // transformation is allowed without any additional clearing step.
  test('Horizontal rule', async() => {
    await resetTo(page, app, '')
    await clickMenuById(app, 'horizontalLineMenuItem')
    // Muya renders HR as <p data-role="hr"> (see CSS: p:not(.ag-active)[data-role='hr']).
    const present = await page
      .locator('.editor-component p[data-role="hr"], .editor-component [data-role="hr"]')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(present).toBe(true)
  })

  test('Math block', async() => {
    await clickMenuById(app, 'mathBlockMenuItem')
    const ok = await page
      .locator('.editor-component .ag-multiple-math, .editor-component figure[data-role="MATH"]')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(ok).toBe(true)
  })

  test('HTML block', async() => {
    await clickMenuById(app, 'htmlBlockMenuItem')
    const ok = await page
      .locator('.editor-component .ag-html-block, .editor-component figure[data-role="HTML"]')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(ok).toBe(true)
  })

  test('Insert table dialog opens and accepts default', async() => {
    // Same constraint as HR — needs empty paragraph + live cursor in Muya.
    // Starting from an empty paragraph ensures block.text === '' so the
    // table transformation is allowed.
    await resetTo(page, app, '')
    await clickMenuById(app, 'tableMenuItem')
    const dialog = page.locator('.ag-dialog-table, .el-overlay').first()
    const dialogVisible = await dialog
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(dialogVisible).toBe(true)
    // Click the OK button to confirm (focus is on the row spinbutton, so Enter alone won't work).
    await page.locator('button:has-text("OK"), .el-button--primary').first().click()
    const tableAppeared = await page
      .locator('.editor-component table')
      .first()
      .waitFor({ state: 'attached', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    expect(tableAppeared).toBe(true)
  })
})
