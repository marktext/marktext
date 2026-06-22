import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  setSourceMarkdown,
  getMarkdownContent
} from './helpers'

// ---------------------------------------------------------------------------
// Coverage backfill (checklist items 30, 42). No e2e anywhere drives
// Tab/Shift-Tab list nesting through the real engine (only table-drag-bar.spec
// mentions Tab). The @muyajs/core engine routes a `Tab` keydown on the active
// list-item paragraph to ParagraphContent.tabHandler
// (packages/muya/src/block/content/paragraphContent/index.ts): with a previous
// sibling list-item it indents (_indentListItem -> appends the item into a
// nested ul inside the previous li); Shift-Tab unindents (_unindentListItem).
// The keydown reaches the block via Editor's keydown dispatch
// (packages/muya/src/editor/index.ts -> content.keydownHandler -> tabHandler).
//
// This spec locks the desktop WYSIWYG behavior end to end: a 2-item bullet list
// nests on Tab (DOM gains `ul li ul li`, markdown gains the indented child) and
// flattens on Shift-Tab. It also confirms the same for an ordered list and that
// the markdown indent width tracks the marker column.
//
// The companion per-mode `listIndentation` (1/dfm/number/tab) serialization is
// a pure-serializer concern and is covered as a muya-unit slice (see `blocked`)
// — it is not exercisable from the desktop e2e without mutating the user's
// preference store, so it is intentionally not duplicated here.
// ---------------------------------------------------------------------------

// Place the caret inside the Nth (0-based) `span.mu-paragraph-content` in the
// editor and commit it to the engine's model the same way helpers.ts does for
// the first paragraph: collapse the range to the end of the span, fire a
// selectionchange, then a synthetic keyup on the editor root so the engine
// updates its `activeContentBlock` (it derives that from click/keyup events).
const placeCaretInContentSpan = async(page: Page, index: number): Promise<void> => {
  await page.evaluate((idx) => {
    const root = document.querySelector('.editor-component') as HTMLElement | null
    if (!root) return
    root.focus()
    const spans = root.querySelectorAll('span.mu-paragraph-content')
    const target = spans[idx]
    if (!target) return
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(false)
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    root.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
    )
  }, index)
  await page.waitForTimeout(150)
}

// Count how many top-level list items exist (li that are NOT inside a nested
// list) vs. items that live inside a nested list (ul/ol that is itself a
// descendant of an li).
const listShape = async(page: Page): Promise<{ topLevelItems: number; nestedItems: number }> => {
  return await page.evaluate(() => {
    const root = document.querySelector('.editor-component')
    if (!root) return { topLevelItems: 0, nestedItems: 0 }
    const allItems = Array.from(root.querySelectorAll('li'))
    let topLevelItems = 0
    let nestedItems = 0
    for (const li of allItems) {
      // A nested item is one whose nearest ancestor list (ul/ol) is itself
      // inside another li.
      const parentList = li.parentElement
      const inNested = !!parentList && !!parentList.closest('li')
      if (inNested) nestedItems++
      else topLevelItems++
    }
    return { topLevelItems, nestedItems }
  })
}

test.describe('List Tab/Shift-Tab nesting (items 30, 42)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Tab nests the second bullet item under the first; Shift-Tab flattens it', async() => {
    // Seed a flat two-item bullet list via source mode (deterministic), then go
    // back to WYSIWYG.
    await setSourceMarkdown(page, app, '- item one\n- item two\n')
    await page.waitForFunction(
      () => {
        const root = document.querySelector('.editor-component')
        return !!root && root.querySelectorAll('ul li').length >= 2
      },
      null,
      { timeout: 5000 }
    )

    // Sanity: both items are top-level (no nested list yet).
    await expect.poll(() => listShape(page)).toEqual({ topLevelItems: 2, nestedItems: 0 })
    expect(await page.locator('.editor-component ul li ul li').count()).toBe(0)

    // Put the caret in the SECOND list item (index 1 of the content spans),
    // then press Tab. The engine indents item two into a nested ul inside the
    // first li.
    await placeCaretInContentSpan(page, 1)
    await page.keyboard.press('Tab')

    // A nested `ul li ul li` must now exist.
    await page.waitForSelector('.editor-component ul li ul li', {
      state: 'attached',
      timeout: 5000
    })
    await expect.poll(() => listShape(page)).toEqual({ topLevelItems: 1, nestedItems: 1 })

    // The serialized markdown shows item two nested under item one. With the
    // default `listIndentation: 1` (number mode, count 1) the child list sits at
    // the parent's content column, i.e. the `- ` marker width (2 spaces).
    const nestedMd = (await getMarkdownContent(page, app)).replace(/\n+$/, '')
    expect(nestedMd).toBe('- item one\n  - item two')

    // Shift-Tab unindents item two back to the top level — the nested list is
    // gone and both items are siblings again.
    await placeCaretInContentSpan(page, 1)
    await page.keyboard.press('Shift+Tab')

    await page.waitForFunction(
      () => {
        const root = document.querySelector('.editor-component')
        return !!root && root.querySelectorAll('ul li ul li').length === 0
      },
      null,
      { timeout: 5000 }
    )
    await expect.poll(() => listShape(page)).toEqual({ topLevelItems: 2, nestedItems: 0 })

    const flatMd = (await getMarkdownContent(page, app)).replace(/\n+$/, '')
    expect(flatMd).toBe('- item one\n- item two')
  })

  test('Tab cannot nest the FIRST item (no previous sibling) — it stays flat', async() => {
    await setSourceMarkdown(page, app, '- only first\n- only second\n')
    await page.waitForFunction(
      () => {
        const root = document.querySelector('.editor-component')
        return !!root && root.querySelectorAll('ul li').length >= 2
      },
      null,
      { timeout: 5000 }
    )

    // Caret in the FIRST item; Tab must NOT create a nested list (the engine's
    // _canIndentListItem requires a previous sibling list-item).
    await placeCaretInContentSpan(page, 0)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)

    expect(await page.locator('.editor-component ul li ul li').count()).toBe(0)
    await expect.poll(() => listShape(page)).toEqual({ topLevelItems: 2, nestedItems: 0 })
  })

  test('Ordered list nests on Tab with the marker-width indent (3 spaces)', async() => {
    await setSourceMarkdown(page, app, '1. alpha\n2. beta\n')
    await page.waitForFunction(
      () => {
        const root = document.querySelector('.editor-component')
        return !!root && root.querySelectorAll('ol li').length >= 2
      },
      null,
      { timeout: 5000 }
    )

    await placeCaretInContentSpan(page, 1)
    await page.keyboard.press('Tab')

    await page.waitForSelector('.editor-component ol li ol li', {
      state: 'attached',
      timeout: 5000
    })
    await expect.poll(() => listShape(page)).toEqual({ topLevelItems: 1, nestedItems: 1 })

    // Ordered marker `1. ` is 3 chars wide, so the nested item indents by 3
    // spaces and the nested list restarts its numbering at 1.
    const md = (await getMarkdownContent(page, app)).replace(/\n+$/, '')
    expect(md).toBe('1. alpha\n   1. beta')
  })
})
