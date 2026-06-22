import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  setSourceMarkdown,
  getMarkdownContent,
  typeIntoEditor,
  placeCaretInEditor
} from './helpers'

// Reset the document to a single empty paragraph and place a collapsed caret
// inside it, so typing the HTML shortcut runs against a clean, focused block.
const resetToEmpty = async(page: Page, app: ElectronApplication) => {
  await setSourceMarkdown(page, app, '\n')
  await placeCaretInEditor(page)
}

// Read where the live DOM caret sits relative to the html-block. Returns the
// text inside the html-block's editable code area that precedes the caret so
// the test can prove the cursor landed BETWEEN the `<div>` open and close tags
// (offset 6 == `<div>\n`). Prism splits the source into multiple token spans,
// so we walk the text nodes and accumulate length rather than reading a single
// anchorOffset.
const readCaretContext = (page: Page): Promise<{
  insideHtmlBlock: boolean
  textBeforeCaret: string | null
} | null> =>
  page.evaluate(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return null
    const anchorEl =
      sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : (sel.anchorNode as Element)
    const block = anchorEl?.closest('.mu-html-block') as Element | null
    if (!block) {
      return { insideHtmlBlock: false, textBeforeCaret: null }
    }
    const code = block.querySelector('.mu-codeblock-content') ?? block
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
    let acc = ''
    let node = walker.nextNode()
    while (node) {
      if (node === sel.anchorNode) {
        acc += (node.textContent ?? '').slice(0, sel.anchorOffset)
        return { insideHtmlBlock: true, textBeforeCaret: acc }
      }
      acc += node.textContent ?? ''
      node = walker.nextNode()
    }
    // Caret anchored on an element node (not a text node) — fall back to the
    // full preceding text we accumulated.
    return { insideHtmlBlock: true, textBeforeCaret: acc }
  })

test.describe('HTML block typing shortcut and single-image lowering', () => {
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

  test('typing "<div>" then Enter opens an html-block with caret between the tags', async() => {
    await resetToEmpty(page, app)

    // Type the open tag into the empty paragraph, then commit with Enter.
    await typeIntoEditor(page, '<div>')
    await page.keyboard.press('Enter')

    // An editable html-block must materialize (the HTML_BLOCK_REG path in
    // paragraphContent._enterConvert replaces the paragraph with an html-block).
    await page.waitForSelector('.editor-component .mu-html-block', {
      state: 'attached',
      timeout: 5000
    })
    await expect(page.locator('.editor-component .mu-html-block')).toHaveCount(1)
    // No stray paragraph survives the conversion.
    await expect(
      page.locator('.editor-component p.mu-paragraph')
    ).toHaveCount(0)

    // The block's text content round-trips to the open/blank/close template.
    // (Source-mode serialization appends a trailing newline.)
    await expect
      .poll(async() => await getMarkdownContent(page, app), { timeout: 5000 })
      .toBe('<div>\n\n</div>\n')

    // The caret sits BETWEEN the tags (engine offset 6 == `<div>\n`). The full
    // block text is already proven to be `<div>\n\n</div>` by the round-trip
    // above; here we prove the caret landed inside that block, past the open
    // tag and before the close tag. In the rendered code DOM the line break is
    // a node boundary, so the captured text before the caret is `<div>` (the
    // trailing newline collapses at the node edge) and never includes `</div>`.
    const caret = await readCaretContext(page)
    expect(caret).not.toBeNull()
    expect(caret?.insideHtmlBlock).toBe(true)
    expect(caret?.textBeforeCaret?.replace(/\n+$/, '')).toBe('<div>')
    expect(caret?.textBeforeCaret).not.toContain('</div>')
  })

  test('"<img src=x>" stays a paragraph, not an html-block', async() => {
    // Loading a lone <img> exercises the isSingleImage lowering branch in
    // markdownToState: it must remain a paragraph rather than become a block.
    await setSourceMarkdown(page, app, '<img src=x>\n')
    await page.waitForSelector('.editor-component p.mu-paragraph', {
      state: 'attached',
      timeout: 5000
    })

    // A paragraph is present and NO html-block was created.
    await expect(
      page.locator('.editor-component p.mu-paragraph')
    ).toHaveCount(1)
    await expect(
      page.locator('.editor-component .mu-html-block')
    ).toHaveCount(0)

    // Content round-trips losslessly back to the raw image markup.
    // (Source-mode serialization appends a trailing newline.)
    await expect
      .poll(async() => await getMarkdownContent(page, app), { timeout: 5000 })
      .toBe('<img src=x>\n')
  })
})
