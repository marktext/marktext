import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Item 240 — TOC/outline panel CONTENT + live update.
//
// layout-toggles.spec.ts only asserts the `tocMenuItem` toggle does not throw,
// and toc-scroll.spec.ts only asserts that clicking a node scrolls the editor.
// Neither asserts the rendered tree *content*: that the el-tree node labels and
// their nesting match the document's heading hierarchy, nor that the tree
// updates LIVE when a heading is renamed / added.
//
// Flow under test: editing the editor -> engine `json-change` ->
// editor.vue LISTEN_FOR_CONTENT_CHANGE({ toc: editor.getTOC() }) ->
// store UPDATE_TOC -> listToTree -> toc.vue `el-tree` re-render.

// Initial document with a nested heading hierarchy:
//   # A
//     ## B
//       ### B1
//     ## C
const INITIAL_DOC = '# A\n\n## B\n\n### B1\n\n## C\n'

// Read the rendered ToC tree as an ordered list of { label, depth }. The
// el-tree renders nested nodes inside `.el-tree-node__children` (role="group");
// a node's nesting depth is therefore 1 + the number of `.el-tree-node__children`
// ancestors it has (top-level headings -> depth 1). This mirrors the engine's
// heading `lvl` collapsed to relative nesting by `listToTree`.
const readTocTree = (page: Page): Promise<Array<{ label: string; depth: number }>> =>
  page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('.side-bar-toc .el-tree .el-tree-node')
    ) as HTMLElement[]
    return nodes.map((node) => {
      const labelEl = node.querySelector(':scope > .el-tree-node__content .el-tree-node__label')
      const label = (labelEl?.textContent || '').trim()
      let depth = 1
      let parent = node.parentElement
      while (parent) {
        if (parent.classList.contains('el-tree-node__children')) depth++
        parent = parent.parentElement
      }
      return { label, depth }
    })
  })

const readTocLabels = async(page: Page): Promise<string[]> =>
  (await readTocTree(page)).map((n) => n.label)

const ensureSidebarVisible = async(app: ElectronApplication, page: Page): Promise<void> => {
  const visible = await page.evaluate(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return !!(el && el.offsetParent !== null)
  })
  if (!visible) {
    await clickMenuById(app, 'sideBarMenuItem')
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.side-bar') as HTMLElement | null
        return !!(el && el.offsetParent !== null)
      },
      null,
      { timeout: 5000 }
    )
  }
}

test.describe('TOC panel content + live update', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(INITIAL_DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await ensureSidebarVisible(app, page)
    // Switch the sidebar right-column to the ToC (el-tree).
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 10000 })
    // The tree is seeded from `editor.getTOC()` on mount. Wait until every
    // initial heading has rendered a node before asserting.
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 4,
      null,
      { timeout: 10000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('el-tree labels match the document headings in order', async() => {
    const labels = await readTocLabels(page)
    expect(labels).toEqual(['A', 'B', 'B1', 'C'])
  })

  test('el-tree nesting depth matches the heading hierarchy', async() => {
    const tree = await readTocTree(page)
    // # A -> depth 1; ## B -> depth 2 (child of A); ### B1 -> depth 3
    // (child of B); ## C -> depth 2 (sibling of B, child of A).
    expect(tree).toEqual([
      { label: 'A', depth: 1 },
      { label: 'B', depth: 2 },
      { label: 'B1', depth: 3 },
      { label: 'C', depth: 2 }
    ])
  })

  test('renaming a heading updates its tree label live', async() => {
    // Place the caret at the end of the "B1" heading and append " Renamed".
    await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll('.mu-container h1, .mu-container h2, .mu-container h3')
      ) as HTMLElement[]
      const normalize = (s: string) => s.replace(/^[#\s]+/, '').trim()
      const target = headings.find((h) => normalize(h.textContent || '') === 'B1')
      if (!target) throw new Error('B1 heading not found in editor')
      const range = document.createRange()
      range.selectNodeContents(target)
      range.collapse(false)
      const sel = window.getSelection()
      if (!sel) throw new Error('no selection')
      sel.removeAllRanges()
      sel.addRange(range)
      ;(target as HTMLElement).focus?.()
      const root = document.querySelector('.editor-component') as HTMLElement | null
      root?.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
      )
    })
    await page.keyboard.type(' Renamed', { delay: 0 })

    // json-change -> UPDATE_TOC -> el-tree re-render. Poll until reflected.
    await expect
      .poll(() => readTocLabels(page), { timeout: 8000 })
      .toEqual(['A', 'B', 'B1 Renamed', 'C'])

    // Nesting must be unchanged by the rename.
    const tree = await readTocTree(page)
    expect(tree).toEqual([
      { label: 'A', depth: 1 },
      { label: 'B', depth: 2 },
      { label: 'B1 Renamed', depth: 3 },
      { label: 'C', depth: 2 }
    ])
  })

  test('adding a new heading adds a tree node live', async() => {
    // Click directly on the last heading ("C") so the engine sets it as the
    // active content block, move the caret to the end, then split with Enter
    // and type a new ATX heading. Clicking the real DOM node (rather than a
    // synthetic range) is what makes muya commit `activeContentBlock`, so the
    // subsequent Enter creates a fresh block instead of editing inside "C".
    const cContent = page
      .locator('.mu-container h2 .mu-atxheading-content')
      .filter({ hasText: 'C' })
      .last()
    await cContent.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## D ', { delay: 20 })

    // The new heading appears as a fourth top-level subtree under A
    // (level-2 sibling of B and C).
    await expect
      .poll(() => readTocLabels(page), { timeout: 8000 })
      .toEqual(['A', 'B', 'B1 Renamed', 'C', 'D'])

    const tree = await readTocTree(page)
    expect(tree).toEqual([
      { label: 'A', depth: 1 },
      { label: 'B', depth: 2 },
      { label: 'B1 Renamed', depth: 3 },
      { label: 'C', depth: 2 },
      { label: 'D', depth: 2 }
    ])
  })
})
