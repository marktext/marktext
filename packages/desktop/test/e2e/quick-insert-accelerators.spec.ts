import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  setSourceMarkdown,
  placeCaretInEditor,
  getMarkdownContent
} from './helpers'

// Item 49 — the quick-insert accelerator shortcuts that convert an EMPTY
// paragraph into a block, driven by the REAL built Electron app.
//
// The accelerators live in the @muyajs/core paragraph quick-insert menu:
//   packages/muya/src/ui/paragraphQuickInsertMenu/config.ts (MENU_CONFIG,
//   getLabelFromEvent) and index.ts (the `handleKeydown` listener attached via
//   `eventCenter.attachDOMEvent(domNode, 'keydown', ...)`).
//
// The handler only fires when the selection is collapsed inside an EMPTY
// `ParagraphContent` block (`if (anchorBlock.text) return`); it then maps the
// keyboard event to a menu label via `getLabelFromEvent` and calls
// `replaceBlockByLabel`. The exact accelerators (verified against config.ts):
//   - Code Block:  altKey:true metaKey:true shiftKey:false code:'KeyC'  (⌥⌘C)
//   - Quote Block: altKey:true metaKey:true shiftKey:false code:'KeyQ'  (⌥⌘Q)
//
// The hint-config + diagram entries are unit-covered
// (packages/muya/src/ui/paragraphQuickInsertMenu/__tests__/hint.spec.ts,
// diagramMenuEntries.spec.ts) and the i18n hint refresh on language switch is
// desktop-e2e-covered (parity-cursor-lang.spec.ts G8); but nothing exercised
// the keyboard accelerators actually inserting a block. This spec covers that
// live path: empty paragraph + caret -> press the accelerator -> assert the
// resulting block DOM and the markdown round-trip.

test.describe('Quick-insert accelerators (item 49)', () => {
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
    // Reset to a single empty paragraph and drop a collapsed caret into it so
    // the engine's activeContentBlock points at an EMPTY ParagraphContent — the
    // precondition the accelerator handler gates on.
    await setSourceMarkdown(page, app, '\n')
    await placeCaretInEditor(page)
    await page.click('.editor-component', { timeout: 5000 })
    await placeCaretInEditor(page)
  })

  test('⌥⌘C converts the empty paragraph into a code block', async() => {
    await page.keyboard.press('Meta+Alt+c')

    const codeBlock = page.locator('.editor-component pre.mu-code-block').first()
    await expect(codeBlock).toBeAttached({ timeout: 5000 })
    await expect(codeBlock.locator('.mu-codeblock-content').first()).toBeAttached()

    // It round-trips to a fenced code block in the serialized markdown.
    await expect.poll(() => getMarkdownContent(page, app)).toContain('```')

    // The blockquote accelerator must NOT have also fired.
    await expect(page.locator('.editor-component blockquote.mu-block-quote')).toHaveCount(0)
  })

  test('⌥⌘Q converts the empty paragraph into a blockquote', async() => {
    await page.keyboard.press('Meta+Alt+q')

    const quote = page.locator('.editor-component blockquote.mu-block-quote').first()
    await expect(quote).toBeAttached({ timeout: 5000 })

    // It round-trips to a `>` blockquote in the serialized markdown.
    await expect.poll(() => getMarkdownContent(page, app)).toMatch(/^>/m)

    // The code-block accelerator must NOT have also fired.
    await expect(page.locator('.editor-component pre.mu-code-block')).toHaveCount(0)
  })
})
