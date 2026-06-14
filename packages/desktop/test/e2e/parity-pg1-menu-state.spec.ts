import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, setSourceMarkdown, waitForMenuReady } from './helpers'

// PARITY SCOREBOARD — gap PG1 (file PG01), desktop e2e half.
//
// The engine-unit half lives in
// packages/muya/src/selection/__tests__/paritySelectionChange.spec.ts.
//
// Legacy muyajs `selectionChange` carried the ancestor block `affiliation`
// chain + block markdown types, which `createApplicationMenuState`
// (store/editor.ts) turned into Paragraph-menu check marks. #4410 restored the
// affiliation chain + per-endpoint block info on the `selection-change`
// payload, and the desktop adapter (`adaptSelectionChange`) now feeds them to
// the store, so the Paragraph-menu check marks light up again. Here we read the
// live application-menu `checked` state after placing the caret in each block
// type and assert that exactly the matching menu item(s) are checked.

interface MenuItemState { id: string; checked: boolean; enabled: boolean }

// Read the id/checked/enabled state of every identifiable Paragraph submenu item.
const paragraphItemStates = async(app: ElectronApplication): Promise<MenuItemState[]> => {
  return await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()
    if (!menu) return []
    const entry = menu.getMenuItemById('paragraphMenuEntry')
    const submenu = entry?.submenu
    if (!submenu) return []
    return submenu.items
      .filter((item) => item.id)
      .map((item) => ({ id: item.id as string, checked: !!item.checked, enabled: !!item.enabled }))
  })
}

const checkedIds = (states: MenuItemState[]): string[] =>
  states.filter((s) => s.checked).map((s) => s.id)

// Click into the block's content span the way a user would (the bug repro is
// "click into each block"). A real click drives Muya's own selection handling,
// which emits the `selection-change` that updates the application menu.
const placeCaretIn = async(page: Page, selector: string): Promise<void> => {
  await page.evaluate((sel) => {
    const span = document.querySelector(sel) as HTMLElement | null
    if (!span) throw new Error(`no element for ${sel}`)
    span.scrollIntoView({ block: 'center' })
    const range = document.createRange()
    range.selectNodeContents(span)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // A real bubbling click drives Muya's editor dispatch → block clickHandler,
    // the path that emits selection-change. Viewport-independent (the editor
    // scrolls its own container, defeating Playwright's click viewport check).
    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  }, selector)
  await page.waitForTimeout(120)
}

// Poll the Paragraph submenu until its checked set matches `expected` (the
// selection-change → menu-state IPC round-trip is async), or time out.
const waitForMenuState = async(
  app: ElectronApplication,
  expected: string[],
  timeout = 3000
): Promise<MenuItemState[]> => {
  const want = [...expected].sort()
  let last: MenuItemState[] = []
  const deadline = Date.now() + timeout
  do {
    last = await paragraphItemStates(app)
    const got = checkedIds(last).sort()
    if (got.length === want.length && got.every((id, i) => id === want[i])) return last
    await new Promise((resolve) => setTimeout(resolve, 100))
  } while (Date.now() < deadline)
  return last
}

interface MenuCase {
  name: string
  markdown: string
  selector: string
  expected: string[]
  // 0.19.1 parity: code-fence-like blocks (math/html/front matter) and tables
  // check their item but keep the whole Paragraph submenu disabled. Only the
  // code fence (and editable leaves) stay enabled.
  disabled?: boolean
}

// Each block type and the Paragraph-menu item(s) that must light up for it.
// `expected` lists every item that should be checked — and, by exclusion,
// asserts no residual checks leak from a previously visited block.
const cases: MenuCase[] = [
  { name: 'h1 heading', markdown: '# A heading\n', selector: 'h1 .mu-atxheading-content', expected: ['heading1MenuItem'] },
  { name: 'paragraph', markdown: 'hello world\n', selector: '.mu-paragraph-content', expected: ['paragraphMenuItem'] },
  { name: 'bullet list', markdown: '- item\n', selector: '.mu-bullet-list .mu-paragraph-content', expected: ['bulletListMenuItem'] },
  { name: 'ordered list', markdown: '1. item\n', selector: '.mu-order-list .mu-paragraph-content', expected: ['orderListMenuItem'] },
  { name: 'task list', markdown: '- [ ] task\n', selector: '.mu-task-list .mu-paragraph-content', expected: ['taskListMenuItem'] },
  { name: 'loose list', markdown: '- one\n\n- two\n', selector: '.mu-bullet-list .mu-paragraph-content', expected: ['bulletListMenuItem', 'looseListItemMenuItem'] },
  { name: 'quote block', markdown: '> quote\n', selector: '.mu-block-quote .mu-paragraph-content', expected: ['quoteBlockMenuItem'] },
  { name: 'code block', markdown: '```js\nconst a = 1\n```\n', selector: '.mu-code-block .mu-codeblock-content', expected: ['codeFencesMenuItem'] },
  { name: 'math block', markdown: '$$\na = b\n$$\n', selector: '.mu-math-block .mu-codeblock-content', expected: ['mathBlockMenuItem'], disabled: true },
  { name: 'html block', markdown: '<div>hi</div>\n', selector: '.mu-html-block .mu-codeblock-content', expected: ['htmlBlockMenuItem'], disabled: true },
  { name: 'table cell', markdown: '| a | b |\n| - | - |\n| 1 | 2 |\n', selector: '.mu-table-cell-content', expected: ['tableMenuItem'], disabled: true },
  { name: 'horizontal rule', markdown: 'before\n\n---\n\nafter\n', selector: '.mu-thematic-break-content', expected: ['horizontalLineMenuItem'] },
  { name: 'front matter', markdown: '---\ntitle: x\n---\n\nbody\n', selector: '.mu-frontmatter .mu-codeblock-content', expected: ['frontMatterMenuItem'], disabled: true }
]

test.describe('Parity PG1 — Paragraph menu reflects the current block', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed\n')
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  for (const block of cases) {
    test(`PG1: caret in ${block.name} checks ${block.expected.join(' + ')}`, async() => {
      await setSourceMarkdown(page, app, block.markdown)
      await expect(page.locator(block.selector).first()).toBeAttached()
      await placeCaretIn(page, block.selector)

      const states = await waitForMenuState(app, block.expected)
      // Exactly the matching item(s) are checked — no residual checks.
      expect(checkedIds(states).sort()).toEqual([...block.expected].sort())
      // 0.19.1 parity for the enabled state: code-fence-like blocks and tables
      // keep the submenu disabled (check mark stays, greyed); everything else is
      // enabled.
      for (const id of block.expected) {
        expect(
          states.find((s) => s.id === id)?.enabled,
          `${id} enabled === ${!block.disabled}`
        ).toBe(!block.disabled)
      }
    })
  }
})

// Clicking between blocks within ONE document must re-derive the menu. The
// per-case suite above can pass on the post-load selection alone; this suite
// proves the click itself emits the selection-change. The regression: code /
// math / html content (non-Format leaves) did not emit on click, so the menu
// stayed stale — note the code→math→html transitions below all share the same
// content DOM class.
test.describe('Parity PG1 — Paragraph menu updates when switching blocks', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed\n')
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await setSourceMarkdown(
      page,
      app,
      '# Heading\n\nplain paragraph\n\n```js\ncode\n```\n\n$$\na = b\n$$\n\n<div>hi</div>\n'
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  const sequence: Array<{ name: string; selector: string; expected: string }> = [
    { name: 'paragraph', selector: '.mu-paragraph .mu-paragraph-content', expected: 'paragraphMenuItem' },
    { name: 'code', selector: '.mu-code-block .mu-codeblock-content', expected: 'codeFencesMenuItem' },
    { name: 'math', selector: '.mu-math-block .mu-codeblock-content', expected: 'mathBlockMenuItem' },
    { name: 'html', selector: '.mu-html-block .mu-codeblock-content', expected: 'htmlBlockMenuItem' },
    { name: 'heading', selector: 'h1 .mu-atxheading-content', expected: 'heading1MenuItem' },
    { name: 'code (again)', selector: '.mu-code-block .mu-codeblock-content', expected: 'codeFencesMenuItem' }
  ]

  test('PG1: clicking from block to block re-derives the checked item', async() => {
    for (const step of sequence) {
      await placeCaretIn(page, step.selector)
      const states = await waitForMenuState(app, [step.expected])
      expect(checkedIds(states), `after clicking ${step.name}`).toEqual([step.expected])
    }
  })
})
