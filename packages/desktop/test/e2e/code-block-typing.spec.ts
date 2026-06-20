import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  setSourceMarkdown,
  placeCaretInEditor
} from './helpers'

// Item 95 — the live REAL-keyboard path that converts a paragraph into a
// fenced code block with an applied language.
//
// The muya e2e (packages/muya/e2e/tests/typing/code-block.spec.ts)
// deliberately avoids typing the language token after the opening fence,
// because the CodeBlockLanguageSelector popup (`.mu-list-picker`, registered
// in the desktop renderer via editor.vue's `Muya.use(CodeBlockLanguageSelector)`)
// intercepts subsequent keys. That muya spec verifies lang through the
// setContent path instead. This desktop spec covers the missing real-keyboard
// path against the BUILT Electron app.
//
// How the live keyboard flow actually applies the language (verified against
// the engine source):
//   - Typing '```js' into a paragraph emits `content-change`; the language
//     selector searches 'js', shows `.mu-list-picker`, and sets its activeItem
//     to the top fuse match (the `js` alias of `javascript`).
//   - Pressing Enter while the picker is showing routes through
//     baseScrollFloat's keydown handler (selectItem(activeItem)) — NOT the
//     paragraph's `_enterConvert` — so the chosen language ('js') is applied
//     and the paragraph is replaced by a fenced code-block.
// Source of truth: packages/muya/src/ui/codeBlockLanguageSelector/index.ts,
// packages/muya/src/ui/baseScrollFloat/index.ts,
// packages/muya/src/block/content/paragraphContent/index.ts (_enterConvert).

test.describe('Code block typing — real-keyboard fenced conversion (item 95)', () => {
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
    // Reset to a single empty paragraph and drop the caret into it so the
    // engine's activeContentBlock points at the paragraph we type into.
    await setSourceMarkdown(page, app, '\n')
    await placeCaretInEditor(page)
  })

  test('typing ```js + Enter creates a fenced code block with language js', async() => {
    await page.click('.editor-component', { timeout: 5000 })
    // Type the full opening fence WITH the language token, then Enter. Typing
    // the language token before Enter is what lets the picker capture 'js' and
    // apply it on selection.
    await page.keyboard.type('```js', { delay: 30 })
    // Let the `content-change` -> fuse search -> picker render settle so the
    // picker's activeItem is set before Enter routes through it.
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')

    // A fenced code block appears: <pre.mu-code-block.mu-fenced-code>.
    const fenced = page.locator('.editor-component pre.mu-code-block.mu-fenced-code').first()
    await expect(fenced).toBeVisible({ timeout: 5000 })

    // The language-input row shows the applied language 'js'.
    const langInput = fenced.locator('.mu-language-input').first()
    await expect(langInput).toHaveText('js')

    // The code leaf node is present (mu-codeblock-content), confirming the
    // block structure rendered.
    await expect(fenced.locator('.mu-codeblock-content').first()).toBeAttached()

    // Round-trip: serializes back to a fenced block tagged with the language.
    await expect.poll(() => getMarkdownContent(page, app)).toContain('```js')
  })
})
