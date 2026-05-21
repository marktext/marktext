const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, enterSourceMode } = require('./helpers')

// Regression test for https://github.com/marktext/marktext/issues/4121
// Underscores inside inline math (`$...$`) and block math (`$$...$$`) must
// not be highlighted as Markdown emphasis in the source view: in math mode
// they are subscript operators, not italic delimiters.
test.describe('Source view: inline math tokenization (#4121)', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const md = '$\\text{F}_\\text{A} = \\text{F}_\\text{B}$ vs. $F_A = F_B$\n'
    const launched = await launchWithMarkdown(md)
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('underscores inside $...$ are not styled as Markdown emphasis', async() => {
    await enterSourceMode(page, app)

    // Force the entire document to be tokenized so that off-screen lines have
    // their highlight classes flushed to the DOM (defensive — the spec body
    // here is only one line but viewport-driven rendering is brittle).
    await page.waitForFunction(() => {
      const root = document.querySelector('.source-code .CodeMirror')
      if (!root || !root.CodeMirror) return false
      const cm = root.CodeMirror
      // Eagerly retokenize through line 0 to ensure highlight classes land.
      cm.getTokenAt({ line: 0, ch: cm.getLine(0).length }, true)
      return true
    }, null, { timeout: 5000 })

    const emTexts = await page.evaluate(() => {
      const spans = document.querySelectorAll('.source-code .CodeMirror .cm-em')
      return Array.from(spans).map((s) => s.textContent)
    })

    // There is no Markdown emphasis (`_word_` or `*word*`) outside of the
    // math spans in our fixture, so any .cm-em span proves the bug.
    expect(emTexts).toEqual([])
  })
})
