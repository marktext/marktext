import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  enterSourceMode,
  exitSourceMode,
  typeIntoEditor,
  placeCaretInEditor,
  setSourceMarkdown,
  sendIpcToRenderer
} from './helpers'

test.describe('Editor input and source-mode roundtrip', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Hello\n\nStarting paragraph.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Initial markdown is loaded into the editor', async() => {
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('# Hello')
    expect(markdown).toContain('Starting paragraph.')
  })

  test('Toggling source mode preserves content', async() => {
    await enterSourceMode(page, app)
    const md = await page.evaluate(() => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror: { getValue(): string } })
        | null
      return cm ? cm.CodeMirror.getValue() : ''
    })
    expect(md).toContain('# Hello')
    await exitSourceMode(page, app)
    const stillThere = await page.locator('.editor-component').isVisible()
    expect(stillThere).toBe(true)
  })

  test('Typing into the editor appends content', async() => {
    await typeIntoEditor(page, ' typed-token')
    await expect.poll(async() => await getMarkdownContent(page, app)).toContain('typed-token')
  })
})

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 24). The desktop title-bar word/character/
// paragraph counter lives in
// packages/desktop/src/renderer/src/components/titleBar/index.vue: the clickable
// `.word-count > span.text-center-vertical` renders `${HASH[show].short}
// ${wordCount[show]}` where `show` cycles word -> paragraph -> character -> all
// on click (handleWordClick). The counter value flows from
// editor.vue json-change -> LISTEN_FOR_CONTENT_CHANGE -> store/editor.ts tab
// wordCount -> app.vue currentFile.wordCount -> the title-bar `word-count` prop.
// The engine wordCount algorithm itself is unit-covered in
// packages/muya/src/utils/__tests__/wordCount.spec.ts; this spec only locks the
// desktop title-bar wiring (the value tracks edits + follows the active mode).
// ---------------------------------------------------------------------------

const WORD_COUNT_TEXT = '.word-count .text-center-vertical'

// Read the title-bar counter text, e.g. "W 12". Returns the trimmed string.
const counterText = (page: Page): Promise<string> =>
  page.locator(WORD_COUNT_TEXT).innerText()

// Parse the trailing integer off a counter label like "W 12" / "P 3".
const counterValue = async(page: Page): Promise<number> => {
  const text = await counterText(page)
  const match = text.trim().match(/(\d+)\s*$/)
  return match ? Number(match[1]) : NaN
}

// Mirror of the engine's wordCount algorithm
// (packages/muya/src/utils/index.ts) so the test can derive the EXPECTED
// title-bar value from the exact markdown that is actually loaded — the engine
// algorithm itself is already unit-covered in
// packages/muya/src/utils/__tests__/wordCount.spec.ts; this is only used to
// pin the desktop title-bar's value/mode wiring to the live document.
const expectedCount = (markdown: string): { word: number; paragraph: number; character: number; all: number } => {
  const paragraph = markdown.split(/\n{2,}/).filter((line) => line).length
  const removedChinese = markdown.replace(/[一-龥]/g, '')
  const tokens = removedChinese.split(/\s+/).filter((t) => t)
  const chineseWordLength = markdown.length - removedChinese.length
  const word = chineseWordLength + tokens.length
  const character = tokens.reduce((acc, t) => acc + t.length, 0) + chineseWordLength
  const all = markdown.length
  return { word, paragraph, character, all }
}

test.describe('Title-bar word counter (item 24)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Counter\n\nOne two three.\n')
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the counter is mounted and starts in word ("W") mode', async() => {
    const counter = page.locator(WORD_COUNT_TEXT)
    await expect(counter).toBeVisible({ timeout: 5000 })
    await expect.poll(() => counterText(page)).toMatch(/^W\s/)
  })

  test('typing ASCII words + CJK characters raises the word count to the engine value', async() => {
    const before = await counterValue(page)

    // Place the caret at the end of the "One two three." paragraph and append a
    // mix of ASCII words and CJK characters. Each CJK char counts as its own
    // word, so the count must climb (in particular the two CJK chars 你 好 each
    // add a word).
    await placeCaretInEditor(page)
    await typeIntoEditor(page, ' four five 你好')

    // The counter updates async after the json-change round-trip; it must have
    // strictly increased over the pre-typing baseline.
    await expect.poll(() => counterValue(page), { timeout: 5000 }).toBeGreaterThan(before)

    // The displayed value matches the engine's wordCount over the exact markdown
    // that is now loaded (verifies the title-bar tracks the live document, and
    // that the CJK chars each counted as a word).
    const markdown = await getMarkdownContent(page, app)
    await expect.poll(() => counterValue(page), { timeout: 5000 }).toBe(expectedCount(markdown).word)
  })

  test('the counter follows the active display mode as it is cycled', async() => {
    // Seed a deterministic two-paragraph document via source mode so each mode
    // reads a known value independent of earlier typing in this shared app.
    await setSourceMarkdown(page, app, 'alpha beta\n\ngamma 字数\n')
    await page.waitForTimeout(400)

    // Derive the four expected values from the exact markdown that is loaded.
    const markdown = await getMarkdownContent(page, app)
    const expected = expectedCount(markdown)

    const counter = page.locator(WORD_COUNT_TEXT)

    // Default word mode: "W" prefix.
    await expect.poll(() => counterText(page)).toMatch(/^W\s/)
    await expect.poll(() => counterValue(page)).toBe(expected.word)

    // Click cycles word -> paragraph.
    await counter.click()
    await expect.poll(() => counterText(page)).toMatch(/^P\s/)
    await expect.poll(() => counterValue(page)).toBe(expected.paragraph)

    // paragraph -> character.
    await counter.click()
    await expect.poll(() => counterText(page)).toMatch(/^C\s/)
    await expect.poll(() => counterValue(page)).toBe(expected.character)

    // character -> all (raw markdown length, with spaces).
    await counter.click()
    await expect.poll(() => counterText(page)).toMatch(/^A\s/)
    await expect.poll(() => counterValue(page)).toBe(expected.all)

    // all -> wraps back to word.
    await counter.click()
    await expect.poll(() => counterText(page)).toMatch(/^W\s/)
    await expect.poll(() => counterValue(page)).toBe(expected.word)
  })
})

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 169). Edit > Select All flows through
// `mt::editor-edit-action` ('selectAll') -> store/listenForMain.ts
// EDITOR_EDIT_ACTION -> bus 'selectAll' -> editor.vue handleSelectAll, which
// calls editor.value.selectAll() ONLY when editor.value.hasFocus(); when focus
// is in an INPUT/TEXTAREA it does a field .select() and skips the editor.
// No prior unit/e2e covers the menu-driven selectAll (issue-4346 uses a DOM
// range, not the menu action). The engine escalation rules are unit-covered in
// packages/muya/src/selection/__tests__/selectAll.spec.ts; this spec locks the
// desktop IPC + focus-branch wiring against the real engine.
// ---------------------------------------------------------------------------

test.describe('Edit > Select All (item 169)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      'First paragraph alpha.\n\nMiddle paragraph beta.\n\nLast paragraph gamma.\n'
    )
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Select All escalates the selection to the whole WYSIWYG document', async() => {
    // Start from a collapsed caret inside the first block. The engine's
    // selectAll escalates (caret -> whole block -> whole document), and the
    // application menu invokes it repeatedly, so we invoke until the selection
    // spans every block (text from the first AND the last paragraph present).
    await placeCaretInEditor(page)

    const wholeDoc = async(): Promise<boolean> => {
      await sendIpcToRenderer(app, 'mt::editor-edit-action', 'selectAll')
      await page.waitForTimeout(120)
      const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
      return (
        selected.includes('First paragraph alpha.') &&
        selected.includes('Last paragraph gamma.')
      )
    }

    await expect.poll(wholeDoc, { timeout: 5000 }).toBe(true)

    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected).toContain('First paragraph alpha.')
    expect(selected).toContain('Middle paragraph beta.')
    expect(selected).toContain('Last paragraph gamma.')
  })

  test('Select All while focus is in the search input leaves the editor selection alone', async() => {
    // Establish a known whole-document editor selection first (escalate fully).
    await placeCaretInEditor(page)
    await expect
      .poll(async() => {
        await sendIpcToRenderer(app, 'mt::editor-edit-action', 'selectAll')
        await page.waitForTimeout(120)
        return page.evaluate(() => window.getSelection()?.toString() ?? '')
      }, { timeout: 5000 })
      .toContain('Last paragraph gamma.')

    // Open the find bar and move focus into its search input. handleSelectAll
    // takes the !hasFocus() branch and does a field select on the input, so the
    // editor's DOM selection must NOT be re-expanded by this action.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const findInput = page.locator('.search-bar .search input')
    await expect(findInput).toBeVisible({ timeout: 5000 })
    await findInput.fill('beta')
    await findInput.focus()
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.nodeName ?? ''))
      .toBe('INPUT')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'selectAll')
    await page.waitForTimeout(200)

    // The input's own field selection is what got selected (its full value),
    // and the editor document selection was not touched (focus is in the input,
    // so window.getSelection reflects the input, not the contenteditable).
    const inputSelection = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null
      if (!el || el.nodeName !== 'INPUT') return null
      return el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
    })
    expect(inputSelection).toBe('beta')

    // Tear down the find bar so the shared app is left clean.
    await page.keyboard.press('Escape')
    await expect(page.locator('.search-bar')).toBeHidden({ timeout: 5000 })
  })
})
