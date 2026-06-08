// Regression guard for issue #4346: Cannot destructure property
// 'bulletMarkerOrDelimiter' of 'block2.children[0]' as it is undefined.
//
// Adjacent-stack reproduction covers the same null-block-guard family the
// original stack lives in (Muya.dispatchChange -> getMarkdown ->
// ExportMarkdown.generate). The bug surface is list/backspace mutation in
// packages/muyajs/lib/contentState/ + packages/muyajs/lib/utils/exportMarkdown.js.
import { test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  placeCaretInEditor,
  setSourceMarkdown,
  clearRendererErrors,
  expectNoRendererErrors
} from './helpers'

test.describe('Issue #4346: list-block null guards', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Repro\n\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('select-all delete inside a single-item list does not crash', async() => {
    await setSourceMarkdown(page, app, '# Doc\n\n- only item\n')
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
    await page.keyboard.press('ControlOrMeta+A')
    await page.waitForTimeout(50)
    await page.keyboard.press('Delete')
    await page.waitForTimeout(200)
    await page.keyboard.type(' ', { delay: 10 })
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('backspace through every list item until list is empty does not crash', async() => {
    await setSourceMarkdown(page, app, '# Doc\n\n- a\n- b\n- c\n')
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
    await page.evaluate(() => {
      const items = document.querySelectorAll('.editor-component ul li span.mu-paragraph-content')
      const last = items[items.length - 1] as HTMLElement | null
      if (!last) return
      const range = document.createRange()
      range.selectNodeContents(last)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    await page.waitForTimeout(100)
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(20)
    }
    await page.keyboard.type('x', { delay: 10 })
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('task list to bullet list transitions do not crash', async() => {
    await setSourceMarkdown(page, app, '# Doc\n\n- [ ] task one\n- [x] task two\n- regular item\n')
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
    await page.evaluate(() => {
      const items = document.querySelectorAll('.editor-component li span.mu-paragraph-content')
      const last = items[items.length - 1] as HTMLElement | null
      if (!last) return
      const range = document.createRange()
      range.selectNodeContents(last)
      range.collapse(true) // start
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    await page.waitForTimeout(100)
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(15)
    }
    await page.keyboard.type('z', { delay: 5 })
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('paste HTML with empty list does not crash', async() => {
    const html = '<p>Before</p><ul></ul><ul><li></li></ul><ol></ol><p>After</p>'
    await page.evaluate((h) => {
      const target = document.querySelector('.editor-component span.mu-paragraph-content') as HTMLElement | null
      if (!target) return
      const range = document.createRange()
      range.selectNodeContents(target)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      const dt = new DataTransfer()
      dt.setData('text/html', h)
      dt.setData('text/plain', 'Before After')
      target.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      )
    }, html)
    await page.waitForTimeout(500)
    await page.keyboard.type(' more', { delay: 5 })
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })
})
