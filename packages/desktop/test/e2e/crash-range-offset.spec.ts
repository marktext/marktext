// Regression guard for "Failed to execute 'setStart' on 'Range': There is no
// child at offset N" crashes (issues #4159, #4111, #4101, #4091, #4052,
// #4035, #4006, #4005, #4004, #3996, #3954, #3936, #3929, #3886, #3829,
// #3793, #3790, #3771, #3737, #3727, #3636, #3542, #3378, #2627, #2526).
//
// These tests exercise the user-described recipes from the original bug
// reports — most notably:
//   #2526 — type the literal escaped HTML "\<pre\>some text\</pre\>", then
//           click on or highlight that text.
//   #3737 — delete a code block with the keyboard Backspace at the start of
//           its first line, instead of clicking the "delete" button.
//
// As of develop (post-electron-vite refactor), none of these recipes
// reproduce the crash anymore — the existing clamp at
// src/muya/lib/selection/index.js:528 plus other cumulative fixes appear to
// have closed the bug surface. The tests assert zero
// `mt::handle-renderer-error` IPC events (captured via the helper installed
// by launchElectron); if they start failing, the offset clamp has regressed.
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  expectNoRendererErrors,
  clearRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  typeIntoEditor
} from './helpers'

test.describe('Crash: setStart Range offset', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Repro\n\nSeed.\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('Issue #2526: typing escaped <pre>...</pre> then re-selecting does not crash', async() => {
    // Type literal `\<pre\>some text\</pre\>` as the user described.
    await typeIntoEditor(page, '\\<pre\\>some text\\</pre\\>')
    await page.waitForTimeout(200)

    // The user then clicks on / highlights the text. We simulate by selecting
    // all and then collapsing to caret to provoke setCursorRange across the
    // mixed inline DOM the paragraph now contains. ControlOrMeta+A maps to
    // Cmd+A on macOS and Ctrl+A elsewhere (Select All on both).
    await page.keyboard.press('ControlOrMeta+A')
    await page.waitForTimeout(50)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(50)
    await page.keyboard.press('Home')
    await page.waitForTimeout(50)
    await page.keyboard.press('End')
    await page.waitForTimeout(150)

    await expectNoRendererErrors(app)
  })

  test('Issue #3737: backspace at start of a code block does not crash', async() => {
    // Build a code block via the markdown source-mode round-trip.
    // (Code blocks are rendered as CodeMirror instances inside Muya; the
    // crash from #3737 happens when the user backspaces from the first
    // character of the code into the block container.)
    const { setSourceMarkdown } = await import('./helpers')
    await setSourceMarkdown(page, app, '# Doc\n\n```js\nconst x = 1\n```\n\nafter\n')
    await page.waitForTimeout(400)
    await clearRendererErrors(app)

    // Click into the code block.
    await page.evaluate(() => {
      const block = document.querySelector('.editor-component .CodeMirror, .editor-component pre.mu-active')
      if (block) (block as HTMLElement).click()
    })
    await page.waitForTimeout(150)

    // Send several backspaces (this is what triggers the crash for users who
    // delete the code block from the keyboard instead of via the inline
    // toolbar's delete button).
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(40)
    }

    await expectNoRendererErrors(app)
  })

  // General "mixed-inline" stressor — selection across a paragraph that holds
  // bold/italic/inline-code/math, the most common substrate for setCursorRange
  // miscalculations.
  test('Repeated cursor moves through bold+code+math do not crash', async() => {
    const md = '# Header\n\nThis has **bold**, *italic*, `code`, and $a+b$ math, ~~strike~~ end.\n'
    const { setSourceMarkdown } = await import('./helpers')
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)

    // Move caret across the rich inline content many times — each call
    // re-runs setCursorRange against a paragraph whose childNodes.length is
    // small while textContent.length is much larger (the exact mismatch the
    // clamp bug exploits).
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Home')
      await page.keyboard.press('End')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
    }
    // Now type to trigger inputHandler -> partialRender -> setCursor at an
    // offset that no longer corresponds to a leaf in the new DOM.
    await page.keyboard.type(' xyz', { delay: 10 })
    await page.waitForTimeout(200)

    await expectNoRendererErrors(app)
  })

  // Recipe drawn from closed issues #2874, #3782, #3754: the offset 4294967292
  // crashes all originated in `enterHandler`. Try Enter at end of paragraph
  // with mixed inline content, then inside a list with formatting.
  test('Enter at end of mixed-inline paragraph does not crash', async() => {
    const md = '# H\n\nAlpha **bold** *italic* `code` $a+b$ end\n'
    const { setSourceMarkdown } = await import('./helpers')
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)

    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('new line', { delay: 5 })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    await expectNoRendererErrors(app)
  })

  test('Enter inside list item with inline formatting does not crash', async() => {
    const md = '- item with **bold** and `code`\n- second\n- third\n'
    const { setSourceMarkdown } = await import('./helpers')
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)

    // Click into the first list item and press Enter several times
    await page.evaluate(() => {
      const first = document.querySelector('.editor-component ul li span.mu-paragraph-content') as HTMLElement | null
      if (!first) return
      const range = document.createRange()
      range.selectNodeContents(first)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    await page.waitForTimeout(100)
    await page.keyboard.press('Enter')
    await page.keyboard.type('x', { delay: 5 })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    await expectNoRendererErrors(app)
  })

  // Stress: select-all delete inside a paragraph with inline math, which has
  // historically thrown the largest "offset N" values (#4035, #2627 — offset
  // 4294967292 = -4 >>> 0).
  test('Select-all delete in math-rich paragraph does not crash', async() => {
    const md = '# H\n\nstart $\\int_0^1 x$ middle $\\frac{a}{b}$ end\n'
    const { setSourceMarkdown } = await import('./helpers')
    await setSourceMarkdown(page, app, md)
    await page.waitForTimeout(400)
    await placeCaretInEditor(page)
    await clearRendererErrors(app)

    await page.keyboard.press('ControlOrMeta+A')
    await page.waitForTimeout(50)
    await page.keyboard.press('Delete')
    await page.waitForTimeout(100)
    await page.keyboard.type('replacement', { delay: 10 })
    await page.waitForTimeout(200)

    await expectNoRendererErrors(app)
  })
})

// Paste-induced crash recipes: many "setStart" crashes in user reports
// mention pasting (HTML from a browser, formatted text from Word). The paste
// path goes through html2State → markdownToState → render → setCursor.
test.describe('Crash: paste-induced setCursorRange', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nEdit here.\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('Paste rich HTML into mid-paragraph does not crash', async() => {
    // Place caret in the middle of "Edit here." then dispatch a paste event
    // with rich HTML (bold + lists + table + math fragment) — the worst case
    // for the DOM-walking selection logic.
    const html =
      '<p>Pasted <b>bold</b> and <i>italic</i> with <code>code</code>.</p>' +
      '<ul><li>one</li><li>two <strong>two-strong</strong></li></ul>' +
      '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>' +
      '<p>And inline math: <span class="math">a+b</span></p>'
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
      dt.setData('text/plain', 'Pasted bold and italic')
      target.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      )
    }, html)
    await page.waitForTimeout(400)
    await expectNoRendererErrors(app)
  })

  test('Paste then immediate cursor-shuffle does not crash', async() => {
    const html = '<p>x<b>y</b>z <em>e</em><code>c</code></p>'.repeat(20)
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
      dt.setData('text/plain', 'x'.repeat(200))
      target.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      )
    }, html)
    await page.waitForTimeout(300)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight')
    }
    await expectNoRendererErrors(app)
  })
})

// Sanity test: ensure the crash counter works (a renderer-side `throw` should
// be captured by our helper). Guards against silent test failure where the
// helper would always pass.
test.describe('Crash counter sanity', () => {
  test('Forced throw in renderer is captured by getRendererErrors', async() => {
    const { app, page } = await launchWithMarkdown('# Sanity\n', { suppressErrorDialog: true })
    try {
      await page.evaluate(() => {
        setTimeout(() => {
          throw new Error('intentional-sanity-error')
        }, 0)
      })
      const { waitForRendererError } = await import('./helpers')
      const captured = await waitForRendererError(
        app,
        (e) => !!e.message?.includes('intentional-sanity-error'),
        5000
      )
      expect(captured, 'expected the renderer-thrown error to reach the IPC sink').not.toBeNull()
    } finally {
      await app.close()
    }
  })
})
