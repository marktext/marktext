// Regression guard for issue #4374:
//   TypeError: Cannot set properties of undefined (setting 'nextSibling')
//     at ContentState.chopBlockByCursor (enterCtrl.js)
//     at ContentState.enterHandler (enterCtrl.js)
//
// Root cause: enterHandler() walked up from <p> to the parent <li> and
// then called chopBlockByCursor(li.children[0], start.key, ...) — assuming
// the active line lives in li.children[0] (or [1] for task lists). When
// the list item carries multiple content blocks (loose list paragraphs,
// trailing paragraph after a sublist, etc.), the caret's span isn't a
// child of children[0], so findIndex returns -1 and the next statement
// crashes on `children[-1].nextSibling = null`.
//
// Fix (packages/muyajs/lib/contentState/enterCtrl.js): capture the active
// paragraph before promoting `block` to its `li` parent, locate it inside
// li.children, and move any blocks AFTER it (sublist + trailing
// paragraphs) into the new list item. Added a defensive `index === -1`
// early-return inside chopBlockByCursor.
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  setSourceMarkdown
} from './helpers'

const placeCaretInSpanContaining = async(page: Page, needle: string) => {
  await page.evaluate((text) => {
    const spans = document.querySelectorAll('.editor-component span.mu-paragraph-content')
    let target: HTMLElement | null = null
    for (const span of spans) {
      if ((span.textContent ?? '').includes(text)) {
        target = span as HTMLElement
        break
      }
    }
    if (!target) return
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(false) // caret at end
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, needle)
  await page.waitForTimeout(150)
}

test.describe('Issue #4374: enterHandler chopBlockByCursor nextSibling crash', () => {
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

  test('Enter inside the second paragraph of a loose list item does not crash', async() => {
    const md = '# Doc\n\n- first paragraph\n\n  second paragraph\n\n- another item\n'
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(500)
    await placeCaretInSpanContaining(page, 'second paragraph')
    await clearRendererErrors(app)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('Enter in the trailing paragraph of a task list item does not crash', async() => {
    const md = '# Doc\n\n- [ ] task line\n\n  trailing paragraph\n'
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(500)
    await placeCaretInSpanContaining(page, 'trailing paragraph')
    await clearRendererErrors(app)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('Enter in a paragraph after a nested sublist in a loose item does not crash', async() => {
    const md =
      '# Doc\n\n' +
      '- main paragraph\n' +
      '\n' +
      '  - sub one\n' +
      '  - sub two\n' +
      '\n' +
      '  tail paragraph\n'
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(500)
    await placeCaretInSpanContaining(page, 'tail paragraph')
    await clearRendererErrors(app)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('Enter mid-paragraph in second paragraph of loose list item does not crash', async() => {
    const md = '# Doc\n\n- alpha\n\n  beta gamma delta\n'
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(500)
    await placeCaretInSpanContaining(page, 'beta gamma delta')
    await page.keyboard.press('Home')
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    await clearRendererErrors(app)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await expectNoRendererErrors(app)
  })

  test('Enter at end of a single-paragraph list item still creates a new item', async() => {
    // Sanity check that the historical [p] / [p, sublist] code paths still
    // behave: a single-paragraph normal list item splitting on Enter must
    // continue to yield a new list item, not regress to a paragraph break.
    const md = '# Doc\n\n- one\n- two\n'
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(500)

    const liCountBefore = await page.evaluate(
      () => document.querySelectorAll('.editor-component ul > li').length
    )

    await placeCaretInSpanContaining(page, 'one')
    await clearRendererErrors(app)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    await page.keyboard.type('inserted', { delay: 5 })
    await page.waitForTimeout(200)

    const liCountAfter = await page.evaluate(
      () => document.querySelectorAll('.editor-component ul > li').length
    )
    // Splitting `- one` into `- one` + `- inserted` must yield one more <li>,
    // not collapse to a paragraph break or duplicate the original item.
    expect(liCountAfter).toBe(liCountBefore + 1)
    await expectNoRendererErrors(app)
  })
})
