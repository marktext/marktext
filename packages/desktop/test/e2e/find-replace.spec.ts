import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  sendIpcToRenderer,
  focusEditor,
  setSourceMarkdown,
  enterSourceMode,
  exitSourceMode,
  expectNoRendererErrors
} from './helpers'

test.describe('Find bar', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      '# Find test\n\nThe quick brown fox jumps over the lazy dog. needleAlpha and needleBeta.\n'
    )
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Find action reveals .search-bar', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
  })

  test('Replace action shows the search bar in replace mode', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
  })

  test('Escape hides the search bar', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    const searchBar = page.locator('.search-bar')
    await expect(searchBar).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(searchBar).toBeHidden({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Coverage backfill (checklist items 152, 153, 180, 181, 183, 184, 185, 186,
// 187, 189, 191, 194). Each test exercises the DESKTOP find-bar Vue component
// (packages/desktop/src/renderer/src/components/search/index.vue) wired to the
// @muyajs/core engine through the renderer bus + `mt::editor-edit-action` IPC.
// The engine-side search/replace/matchString behaviors are already unit-tested
// in packages/muya; these specs only lock the desktop UI + IPC wiring.
// ---------------------------------------------------------------------------

const SEARCH_BAR = '.search-bar'
const FIND_INPUT = '.search-bar .search input'
const REPLACE_INPUT = '.search-bar .replace .input-wrapper input'
const RESULT_COUNTER = '.search-bar .search-result'
// Replace-all = RefreshRight button (`replace(false)`), the `.right` button in
// the replace row. Replace-single = Switch button (`replace(true)`), the one
// without `.right`.
const REPLACE_ALL_BTN = '.search-bar .replace .button-group .button.right'
const REPLACE_SINGLE_BTN = '.search-bar .replace .button-group .button:not(.right)'

const isTabDirty = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))

// Fire a native click on the first element matching `selector` directly in the
// page context. The replace buttons are wrapped in Element Plus `el-tooltip`s
// whose poppers can linger across tests and intercept a pointer-based
// `locator.click()`; dispatching the event on the resolved element invokes the
// Vue `@click` handler regardless of any overlay, which is exactly the wiring
// these specs mean to exercise.
const clickByEval = async(page: Page, selector: string): Promise<void> => {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return false
    el.click()
    return true
  }, selector)
  if (!clicked) throw new Error('clickByEval: no element matched ' + selector)
}

const undo = (app: ElectronApplication): Promise<void> =>
  sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')

const counterText = (page: Page): Promise<string> =>
  page.locator(RESULT_COUNTER).innerText()

// Read the live WYSIWYG editor text (what the engine has rendered into the
// contenteditable). Verifying replace results this way avoids the source-mode
// round-trip in getMarkdownContent, which re-parses + rebuilds the document on
// exit and can clobber an engine text mutation that has not yet synced to the
// JSON state — a flake that only surfaces when a prior test left pending async
// in the shared app.
const editorText = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector('.editor-component')?.textContent ?? '')

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

// Close the find bar (if open) and reset its inputs to a clean slate so the
// next scenario starts fresh. Escape -> emptySearch() clears searchValue and
// replaceValue and removes engine highlights.
const closeAndReset = async(page: Page): Promise<void> => {
  const bar = page.locator(SEARCH_BAR)
  if (await bar.isVisible()) {
    await page.keyboard.press('Escape')
    await expect(bar).toBeHidden({ timeout: 5000 })
  }
  await expect.poll(() => page.locator('.mu-highlight').count()).toBe(0)
  await expect.poll(() => page.locator('.mu-selection').count()).toBe(0)
}

// Seed the document content for a test and mark the tab clean (records the
// current history entry as `lastSavedHistoryId` + clears the dirty flag), so a
// subsequent edit's effect on the unsaved indicator is observed from a known
// clean baseline. Mirrors the real post-save IPC the main process sends.
const seedDocClean = async(
  app: ElectronApplication,
  page: Page,
  markdown: string
): Promise<void> => {
  await closeAndReset(page)
  await setSourceMarkdown(page, app, markdown)
  await page.waitForTimeout(400)
  const tabId = await page.evaluate(
    () => document.querySelector('.editor-tabs li.active')?.getAttribute('data-id') ?? null
  )
  if (!tabId) throw new Error('could not resolve the active tab id')
  await sendIpcToRenderer(app, 'mt::tab-saved', tabId)
  await expect.poll(() => isTabDirty(page)).toBe(false)
}

const openFind = async(app: ElectronApplication, page: Page): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
  await expect(page.locator(SEARCH_BAR)).toBeVisible({ timeout: 5000 })
}

const openReplace = async(app: ElectronApplication, page: Page): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
  await expect(page.locator(SEARCH_BAR)).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.search-bar .replace')).toBeVisible({ timeout: 5000 })
}

test.describe('Find bar — realtime counter and highlights (item 180)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('apple banana apple cherry apple\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('typed query shows "1 / 3" and one active + two inactive highlights', async() => {
    await openFind(app, page)
    await page.locator(FIND_INPUT).fill('apple')

    // Absorb the 150ms debounce before reading the counter.
    await expect.poll(() => counterText(page)).toContain('1 / 3')

    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)
    await expect.poll(() => page.locator('.mu-selection').count()).toBe(2)
  })
})

test.describe('Find bar — find next / previous navigation (items 152, 181)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('apple one apple two apple three\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('findNext cycles 1/3 -> 2/3 -> 3/3 -> wraps to 1/3, keeping one active highlight', async() => {
    await openFind(app, page)
    await page.locator(FIND_INPUT).fill('apple')
    await expect.poll(() => counterText(page)).toContain('1 / 3')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect.poll(() => counterText(page)).toContain('2 / 3')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect.poll(() => counterText(page)).toContain('3 / 3')

    // Wrap around: 3/3 -> 1/3.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect.poll(() => counterText(page)).toContain('1 / 3')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)
  })

  test('findPrev from 1/3 wraps backward to 3/3 then steps back to 2/3', async() => {
    // Continues from the previous test's 1/3 state.
    await expect.poll(() => counterText(page)).toContain('1 / 3')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findPrev')
    await expect.poll(() => counterText(page)).toContain('3 / 3')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findPrev')
    await expect.poll(() => counterText(page)).toContain('2 / 3')
  })
})

test.describe('Find bar — option toggles re-run the search (items 185, 186, 187)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('placeholder\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('case-sensitive toggle drops the match count and gains the active class', async() => {
    await seedDocClean(app, page, 'Apple and apple are different.\n')
    await openFind(app, page)
    await page.locator(FIND_INPUT).fill('apple')
    // Case-insensitive default matches both "Apple" and "apple".
    await expect.poll(() => counterText(page)).toContain('/ 2')

    const toggle = page.locator('.search-bar .is-case-sensitive')
    await expect(toggle).not.toHaveClass(/active/)
    await toggle.click()
    await expect(toggle).toHaveClass(/active/)
    // Case-sensitive now matches only the lowercase "apple".
    await expect.poll(() => counterText(page)).toContain('/ 1')

    // Reset the toggle for subsequent tests in this shared app.
    await toggle.click()
    await expect(toggle).not.toHaveClass(/active/)
    await closeAndReset(page)
  })

  test('whole-word toggle excludes the substring match and gains the active class', async() => {
    await seedDocClean(app, page, 'a cat in a category\n')
    await openFind(app, page)
    await page.locator(FIND_INPUT).fill('cat')
    // Substring matches both the standalone "cat" and the "cat" in "category".
    await expect.poll(() => counterText(page)).toContain('/ 2')

    const toggle = page.locator('.search-bar .is-whole-word')
    await expect(toggle).not.toHaveClass(/active/)
    await toggle.click()
    await expect(toggle).toHaveClass(/active/)
    // Whole-word leaves only the standalone "cat".
    await expect.poll(() => counterText(page)).toContain('/ 1')

    await toggle.click()
    await expect(toggle).not.toHaveClass(/active/)
    await closeAndReset(page)
  })

  test('regex toggle: invalid + empty-match show error UI, valid pattern highlights', async() => {
    await seedDocClean(app, page, 'apple apricot banana\n')
    await openFind(app, page)

    const regexToggle = page.locator('.search-bar .is-regex')
    await regexToggle.click()
    await expect(regexToggle).toHaveClass(/active/)

    const errorMsg = page.locator('.search-bar .error-msg')

    // The error cases are exercised first, from a fresh find bar with no prior
    // valid search, so 0 highlights cleanly proves "no search ran". (searchFn
    // returns early on an error WITHOUT clearing the previous highlights, so a
    // prior valid match would otherwise linger — that is intentional product
    // behavior, not a bug.)

    // (1) Invalid pattern: unbalanced paren -> "Invalid regular expression"
    // error and no search runs (no highlights).
    await page.locator(FIND_INPUT).fill('(')
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
    await expect(errorMsg).toContainText('Invalid regular expression')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(0)

    // (2) Empty-match pattern: "a*" matches the empty string -> dedicated error,
    // still no search.
    await page.locator(FIND_INPUT).fill('a*')
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
    await expect(errorMsg).toContainText('Regular expression matches empty string')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(0)

    // (3) Valid pattern: matches "apple" and "apricot"; the error clears and the
    // search runs (one active highlight + one inactive selection).
    await page.locator(FIND_INPUT).fill('ap(ple|ricot)')
    await expect.poll(() => counterText(page)).toContain('/ 2')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)
    await expect.poll(() => page.locator('.mu-selection').count()).toBe(1)
    await expect(errorMsg).toHaveCount(0)

    // Reset regex toggle + bar for any later tests in this app.
    await page.locator(FIND_INPUT).fill('')
    await regexToggle.click()
    await expect(regexToggle).not.toHaveClass(/active/)
    await closeAndReset(page)
  })
})

test.describe('Find bar — replace single / all dirty the tab (items 153, 183, 184)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('placeholder\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('replace-single changes exactly one occurrence and flags the tab unsaved (item 183)', async() => {
    await seedDocClean(app, page, 'foo foo foo\n')
    await openReplace(app, page)
    await page.locator(FIND_INPUT).fill('foo')
    await expect.poll(() => counterText(page)).toContain('/ 3')
    await page.locator(REPLACE_INPUT).fill('bar')

    await clickByEval(page, REPLACE_SINGLE_BTN)

    await expect
      .poll(async() => {
        const text = await editorText(page)
        return { bar: countOccurrences(text, 'bar'), foo: countOccurrences(text, 'foo') }
      })
      .toEqual({ bar: 1, foo: 2 })

    await expect.poll(() => isTabDirty(page)).toBe(true)
    await closeAndReset(page)
  })

  test('replace-all replaces every occurrence and flags the tab unsaved (item 184)', async() => {
    await seedDocClean(app, page, 'cat cat cat\n')
    await openReplace(app, page)
    await page.locator(FIND_INPUT).fill('cat')
    await expect.poll(() => counterText(page)).toContain('/ 3')
    await page.locator(REPLACE_INPUT).fill('dog')

    await clickByEval(page, REPLACE_ALL_BTN)

    await expect
      .poll(async() => {
        const text = await editorText(page)
        return { dog: countOccurrences(text, 'dog'), cat: countOccurrences(text, 'cat') }
      })
      .toEqual({ dog: 3, cat: 0 })
    await expect.poll(() => isTabDirty(page)).toBe(true)

    // Searching the old word now reports zero matches.
    await page.locator(FIND_INPUT).fill('cat')
    await expect.poll(() => counterText(page)).toContain('/ 0')
    await closeAndReset(page)
  })

  test('replace-all across multiple blocks + undo restores every occurrence (items 153, 184)', async() => {
    await seedDocClean(app, page, '# alpha heading\n\nalpha paragraph\n\n- alpha item\n')
    await openReplace(app, page)
    await page.locator(FIND_INPUT).fill('alpha')
    await expect.poll(() => counterText(page)).toContain('/ 3')
    await page.locator(REPLACE_INPUT).fill('omega')

    await clickByEval(page, REPLACE_ALL_BTN)

    await expect
      .poll(async() => {
        const text = await editorText(page)
        return { omega: countOccurrences(text, 'omega'), alpha: countOccurrences(text, 'alpha') }
      })
      .toEqual({ omega: 3, alpha: 0 })
    // The replace-all dirtied the tab (#4431 saved-indicator wiring).
    await expect.poll(() => isTabDirty(page)).toBe(true)

    // Close the bar before undoing so the engine cursor is back in the document
    // (the find bar holds focus while open) and the undo applies cleanly.
    await closeAndReset(page)

    // Undo reverts the content AND clears the unsaved indicator (back to the
    // seeded-clean baseline content + history id).
    await undo(app)
    await expect
      .poll(async() => {
        const text = await editorText(page)
        return { omega: countOccurrences(text, 'omega'), alpha: countOccurrences(text, 'alpha') }
      })
      .toEqual({ omega: 0, alpha: 3 })
    await expect.poll(() => isTabDirty(page)).toBe(false)
  })
})

test.describe('Find bar — left arrow toggles replace mode (item 191)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('toggle target\n')
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('left-arrow shows the replace row, then hides it again', async() => {
    await openFind(app, page)
    const replaceRow = page.locator('.search-bar .replace')
    await expect(replaceRow).toHaveCount(0)

    await page.locator('.search-bar .left-arrow').click()
    await expect(replaceRow).toBeVisible({ timeout: 5000 })
    await expect(page.locator(REPLACE_ALL_BTN)).toBeVisible()
    await expect(page.locator(REPLACE_SINGLE_BTN)).toBeVisible()

    await page.locator('.search-bar .left-arrow').click()
    await expect(replaceRow).toHaveCount(0)
    await closeAndReset(page)
  })
})

test.describe('Find bar — Escape clears highlights and restores the cursor (item 189)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      'The quick needleAlpha brown fox and needleBeta jumps.\n'
    )
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Escape after a query clears every highlight and selects the active match', async() => {
    await openFind(app, page)
    await page.locator(FIND_INPUT).fill('needleAlpha')
    await expect.poll(() => counterText(page)).toContain('1 / 1')
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(1)

    await page.keyboard.press('Escape')
    await expect(page.locator(SEARCH_BAR)).toBeHidden({ timeout: 5000 })

    // (a) Highlights and selections are fully torn down.
    await expect.poll(() => page.locator('.mu-highlight').count()).toBe(0)
    await expect.poll(() => page.locator('.mu-selection').count()).toBe(0)

    // (b) The editor cursor is restored onto the last active match: the engine's
    // selectHighlight path calls block.setCursor(start, end), leaving the DOM
    // selection spanning the matched word so the user can keep typing there.
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('needleAlpha')
  })
})

test.describe('Find bar — suppressed in source-code mode (item 194)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(
      '# Source mode\n\nfind me in source mode if you can.\n',
      { suppressErrorDialog: true }
    )
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the WYSIWYG search bar is not mounted while in source-code mode', async() => {
    await enterSourceMode(page, app)

    // The find action is forwarded but the WYSIWYG `.search-bar` is `v-if`-gated
    // off in source mode, so it must not be present in the DOM.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
    await page.waitForTimeout(300)
    await expect(page.locator(SEARCH_BAR)).toHaveCount(0)

    await expectNoRendererErrors(app)
    await exitSourceMode(page, app)
  })
})
