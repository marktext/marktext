import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  getMarkdownContent,
  launchWithMarkdown,
  placeCaretInEditor,
  sendIpcToRenderer,
  typeIntoEditor
} from './helpers'

const tabSelector = '.tabs-container > li'

// Reach into the live Pinia `editor` store through the mounted Vue app. The
// renderer exposes the active pinia instance on `#app.__vue_app__` via
// `config.globalProperties.$pinia`, and pinia keeps its registered stores in
// the internal `_s` Map keyed by id. Driving `CLOSE_OTHER_TABS` /
// `CLOSE_SAVED_TABS` / `CLOSE_ALL_TABS` here runs the EXACT production action
// the tab context-menu bus events (`TABS::close-others` / `close-saved` /
// `close-all`) delegate to — the bus itself is a module-scoped mitt emitter
// not reachable from `page.evaluate`, so the store handle is the headless
// equivalent of clicking the (native, non-headless) context-menu entries.
const callEditorStoreAction = (
  page: Page,
  action: string,
  tabId?: string
): Promise<boolean> =>
  page.evaluate(
    ({ actionName, id }) => {
      const root = document.querySelector('#app') as
        | (Element & { __vue_app__?: { config?: { globalProperties?: Record<string, unknown> } } })
        | null
      const pinia = root?.__vue_app__?.config?.globalProperties?.$pinia as
        | { _s?: Map<string, Record<string, (...args: unknown[]) => unknown>> }
        | undefined
      const store = pinia?._s?.get('editor')
      if (!store || typeof store[actionName] !== 'function') return false
      if (id) {
        const tab = (store.tabs as unknown as Array<{ id: string }>).find((t) => t.id === id)
        if (!tab) return false
        store[actionName](tab)
      } else {
        store[actionName]()
      }
      return true
    },
    { actionName: action, id: tabId }
  )

// The live tab list as the ordered `data-id`s rendered in the tab bar. The
// close-* survivor assertions compare against this.
const readTabIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.tabs-container > li')).map(
      (li) => li.getAttribute('data-id') ?? ''
    )
  )

const activeTabId = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('.tabs-container > li.active')?.getAttribute('data-id') ?? null
  )

test.describe('Tab management', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Tab base\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Initial document loads as a single tab in the tab list', async() => {
    // Tab bar may be hidden by default (v-show), but the DOM still contains the list.
    await page.waitForSelector('.tabs-container', { state: 'attached', timeout: 5000 })
    const count = await page.locator(tabSelector).count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Creating a new untitled tab grows the tab count', async() => {
    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => {
        return document.querySelectorAll(selector).length > prev
      },
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )
    const after = await page.locator(tabSelector).count()
    expect(after).toBeGreaterThan(before)
  })

  test('Creating a new untitled tab auto-focuses the editor', async() => {
    // Drop focus first so the assertion proves the NEW tab grabbed focus rather
    // than inheriting a stale one from the previously active editor.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )

    // A freshly created untitled tab auto-focuses the WYSIWYG editor: the
    // contenteditable (`.editor-component`) becomes `document.activeElement`,
    // AND a collapsed caret lands inside it — together that's the blinking
    // cursor the user expects without having to click into the editor first.
    const isFocusedWithCaret = () => {
      const root = document.querySelector('.editor-component')
      const active = document.activeElement
      const sel = window.getSelection()
      return (
        !!root &&
        !!active &&
        (root === active || root.contains(active)) &&
        !!sel &&
        sel.rangeCount > 0 &&
        sel.isCollapsed &&
        !!sel.anchorNode &&
        root.contains(sel.anchorNode)
      )
    }
    await page.waitForFunction(isFocusedWithCaret, null, { timeout: 5000 })
    expect(await page.evaluate(isFocusedWithCaret)).toBe(true)
  })

  // Item 251 — switching between two populated tabs swaps the editor BODY, not
  // just the active-tab highlight. Proves UPDATE_CURRENT_FILE -> file-changed ->
  // setContent re-renders the document on every switch.
  test('Switching tabs swaps the editor body to match the tab', async() => {
    // Tab index 0 is the launch tab ('# Tab base'); open a fresh tab B whose
    // body is distinct, auto-selected.
    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'second body\n')
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )
    const bId = await activeTabId(page)
    expect(bId).toBeTruthy()

    // The newly-selected tab B shows B's body.
    await expect
      .poll(async() => (await getMarkdownContent(page, app)).trim(), { timeout: 5000 })
      .toBe('second body')

    // Switch to index 0 — the editor body must revert to tab A's content and the
    // active tab id must change away from B.
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect
      .poll(async() => (await getMarkdownContent(page, app)).trim(), { timeout: 5000 })
      .toBe('# Tab base')
    expect(await activeTabId(page)).not.toBe(bId)

    // Switch to tab B by id (re-derive its index) — body swaps back to B.
    const ids = await readTabIds(page)
    const bIndex = ids.indexOf(bId as string)
    expect(bIndex).toBeGreaterThanOrEqual(0)
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', bIndex)
    await expect
      .poll(async() => (await getMarkdownContent(page, app)).trim(), { timeout: 5000 })
      .toBe('second body')
    expect(await activeTabId(page)).toBe(bId)
  })

  // Item 262 — a blank untitled tab is NOT marked unsaved before any input
  // (the engine's lone-'\n' init json-change is guarded in
  // LISTEN_FOR_CONTENT_CHANGE), and flips to unsaved on the first real keystroke.
  test('Blank untitled tab is clean until the first keystroke', async() => {
    const before = await page.locator(tabSelector).count()
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await page.waitForFunction(
      ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
      { selector: tabSelector, prev: before },
      { timeout: 5000 }
    )

    // The freshly-created active tab must stay clean: its <li> has `active` but
    // not `unsaved` (= file.isSaved is true) before any input. Poll briefly so a
    // late guarded init json-change can't race the assertion.
    const activeIsClean = () => {
      const li = document.querySelector('.tabs-container > li.active')
      return !!li && !li.classList.contains('unsaved')
    }
    await expect.poll(() => page.evaluate(activeIsClean), { timeout: 3000 }).toBe(true)
    // Hold the clean state for a moment to rule out a delayed dirty flip.
    await page.waitForTimeout(300)
    expect(await page.evaluate(activeIsClean)).toBe(true)

    // First real character marks the tab unsaved.
    await placeCaretInEditor(page)
    await typeIntoEditor(page, 'X')
    await expect
      .poll(
        () =>
          page.evaluate(
            () => !!document.querySelector('.tabs-container > li.active.unsaved')
          ),
        { timeout: 5000 }
      )
      .toBe(true)
  })

  // Item 15 — the engine undo history is per-tab (`engineHistoryByTab`),
  // restored on each `file-changed` (tab switch). After switching back to tab A,
  // one undo must revert A's OWN last edit back to A's pre-edit (on-disk)
  // baseline, never tab B's edit; B's edit must never have leaked into A; and
  // the per-tab unsaved indicator must track A's TRUE dirty state across the
  // round-trip (dirty after A's edit, clean once A is undone back to disk).
  //
  // (The recipe's optional `redo` re-apply is intentionally not asserted here:
  // driving redo through the edit-action IPC re-applies relative to the live
  // DOM caret, which a synthetic Playwright selection cannot faithfully
  // reproduce after the undo re-render — the engine's own
  // historySerialization.spec.ts already proves redo is lossless when the
  // caret is correctly seated. The mandatory per-tab undo isolation below is
  // fully and faithfully exercised.)
  test('Per-tab undo history survives a tab switch', async() => {
    // Tab A: a known saved baseline so the dirty/undo round-trip is observable.
    const aLaunch = await launchWithMarkdown('alpha\n')
    const aApp = aLaunch.app
    const aPage = aLaunch.page
    const isDirty = () =>
      aPage.evaluate(() => !!document.querySelector('.tabs-container > li.active.unsaved'))
    try {
      // Edit A: append a sentinel so A's engine history has an undo boundary and
      // the tab is dirtied. The trailing ' end' padding guards the asserted
      // 'MARKERA' token against the occasional dropped FINAL keystroke when
      // typing into the contenteditable at delay:0.
      await placeCaretInEditor(aPage)
      await typeIntoEditor(aPage, ' MARKERA end')
      await expect
        .poll(async() => (await getMarkdownContent(aPage, aApp)).trim(), { timeout: 5000 })
        .toContain('MARKERA')
      await expect.poll(isDirty, { timeout: 5000 }).toBe(true)
      const aTabId = await activeTabId(aPage)
      expect(aTabId).toBeTruthy()

      // Open tab B (auto-selected) and make a DIFFERENT edit in it.
      await sendIpcToRenderer(aApp, 'mt::new-untitled-tab', true, 'bravo\n')
      await aPage.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 2,
        tabSelector,
        { timeout: 5000 }
      )
      await aPage.waitForTimeout(250)
      await placeCaretInEditor(aPage)
      await typeIntoEditor(aPage, ' MARKERB end')
      await expect
        .poll(async() => (await getMarkdownContent(aPage, aApp)).trim(), { timeout: 5000 })
        .toContain('MARKERB')

      // Switch back to tab A by its id's index.
      const ids = await readTabIds(aPage)
      const aIndex = ids.indexOf(aTabId as string)
      expect(aIndex).toBeGreaterThanOrEqual(0)
      await sendIpcToRenderer(aApp, 'mt::switch-tab-by-index', aIndex)
      await expect
        .poll(async() => (await getMarkdownContent(aPage, aApp)).trim(), { timeout: 5000 })
        .toContain('MARKERA')
      // A is shown again (its own edit), B's edit never leaked into A, and A is
      // still dirty from its own un-undone edit.
      expect((await getMarkdownContent(aPage, aApp)).trim()).not.toContain('MARKERB')
      expect(await activeTabId(aPage)).toBe(aTabId)
      await expect.poll(isDirty, { timeout: 5000 }).toBe(true)

      // Undo against A's RESTORED per-tab history reverts A's own edit back to
      // the on-disk baseline 'alpha' — proving the history rode the tab switch
      // with the right tab. The keystroke run may have been recorded as one or
      // (rarely, if a render split it) a few engine undo boundaries, so undo
      // until the document settles on the baseline; each step must keep removing
      // A's text and never resurrect B's.
      await expect
        .poll(
          async() => {
            const current = (await getMarkdownContent(aPage, aApp)).trim()
            if (current === 'alpha') return current
            await sendIpcToRenderer(aApp, 'mt::editor-edit-action', 'undo')
            await aPage.waitForTimeout(300)
            return (await getMarkdownContent(aPage, aApp)).trim()
          },
          { timeout: 8000 }
        )
        .toBe('alpha')
      // It reverted A's edit, NOT B's (B's edit never appears).
      expect((await getMarkdownContent(aPage, aApp)).trim()).not.toContain('MARKERB')
      // Undoing back to the exact on-disk content clears A's unsaved indicator.
      await expect.poll(isDirty, { timeout: 5000 }).toBe(false)
    } finally {
      await aApp.close()
    }
  })

  // Issue #3958 — switching to a tab that has overflowed off the right edge of
  // the tab bar must scroll it back into the visible viewport. Before the fix
  // the active tab is highlighted but invisible (the strip never scrolls), so
  // the user can't see which tab they're on. Runs in its own app because it
  // opens many tabs to force horizontal overflow.
  test('Switching to an overflowed tab scrolls it into view', async() => {
    const launch = await launchWithMarkdown('# overflow base\n')
    const sApp = launch.app
    const sPage = launch.page
    try {
      // Open enough untitled tabs to overflow the tab strip horizontally,
      // regardless of the test window width.
      const TAB_COUNT = 25
      for (let i = 0; i < TAB_COUNT; i++) {
        const before = await sPage.locator(tabSelector).count()
        await sendIpcToRenderer(sApp, 'mt::new-untitled-tab', true, `overflow body ${i}\n`)
        await sPage.waitForFunction(
          ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
          { selector: tabSelector, prev: before },
          { timeout: 5000 }
        )
      }

      // The strip must genuinely overflow, otherwise the assertions below are
      // vacuously true.
      await expect
        .poll(
          () =>
            sPage.evaluate(() => {
              const c = document.querySelector('.scrollable-tabs') as HTMLElement | null
              return !!c && c.scrollWidth > c.clientWidth + 4
            }),
          { timeout: 5000 }
        )
        .toBe(true)

      // The active tab's box must sit fully inside the scroll viewport.
      const activeTabVisible = () =>
        sPage.evaluate(() => {
          const container = document.querySelector('.scrollable-tabs')
          const tab = document.querySelector('.tabs-container > li.active')
          if (!container || !tab) return false
          const c = container.getBoundingClientRect()
          const t = tab.getBoundingClientRect()
          return t.width > 0 && t.left >= c.left - 1 && t.right <= c.right + 1
        })

      // Far-left tab: must be brought into view.
      await sendIpcToRenderer(sApp, 'mt::switch-tab-by-index', 0)
      await expect.poll(activeTabVisible, { timeout: 5000 }).toBe(true)

      // Far-right (last) tab: at scrollLeft 0 it is off the right edge — the
      // regression. Switching to it must scroll the strip so it's visible.
      const ids = await readTabIds(sPage)
      await sendIpcToRenderer(sApp, 'mt::switch-tab-by-index', ids.length - 1)
      await expect.poll(activeTabVisible, { timeout: 5000 }).toBe(true)

      // Back to the first tab: must scroll left again.
      await sendIpcToRenderer(sApp, 'mt::switch-tab-by-index', 0)
      await expect.poll(activeTabVisible, { timeout: 5000 }).toBe(true)
    } finally {
      await sApp.close()
    }
  })

  // Item 267 — the tab context-menu "close others / close saved / close all"
  // survivor sets. Driven through the live `editor` store actions (the bus
  // events delegate verbatim to these; the native context menu / mitt bus are
  // not headless-reachable). All tabs kept SAVED so no unsaved-close dialog
  // blocks. Runs in its own app so the close-all teardown can't disturb the
  // shared-app tests above.
  test('Context-menu close-others / close-saved / close-all survivor sets', async() => {
    const launch = await launchWithMarkdown('# keep\n')
    const cApp = launch.app
    const cPage = launch.page
    try {
      // Helper: open `n` extra untitled tabs with distinct content and mark
      // every existing tab SAVED via the real `mt::tab-saved` save-confirm IPC.
      const openSavedTabs = async(bodies: string[]): Promise<void> => {
        for (const body of bodies) {
          const before = await cPage.locator(tabSelector).count()
          await sendIpcToRenderer(cApp, 'mt::new-untitled-tab', true, body)
          await cPage.waitForFunction(
            ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
            { selector: tabSelector, prev: before },
            { timeout: 5000 }
          )
          await cPage.waitForTimeout(150)
        }
        const ids = await readTabIds(cPage)
        for (const id of ids) await sendIpcToRenderer(cApp, 'mt::tab-saved', id)
        await expect
          .poll(
            () => cPage.evaluate(() => !!document.querySelector('.tabs-container > li.unsaved')),
            { timeout: 5000 }
          )
          .toBe(false)
      }

      // --- close-others: keep exactly the chosen tab ---
      await openSavedTabs(['body one\n', 'body two\n'])
      let ids = await readTabIds(cPage)
      expect(ids.length).toBeGreaterThanOrEqual(3)
      const keepId = ids[1] as string
      expect(await callEditorStoreAction(cPage, 'CLOSE_OTHER_TABS', keepId)).toBe(true)
      await expect
        .poll(() => readTabIds(cPage), { timeout: 5000 })
        .toEqual([keepId])

      // --- close-saved: every saved tab closes ---
      // Top up to several SAVED tabs again, then close-saved -> none survive.
      await openSavedTabs(['saved A\n', 'saved B\n'])
      ids = await readTabIds(cPage)
      expect(ids.length).toBeGreaterThanOrEqual(3)
      expect(await callEditorStoreAction(cPage, 'CLOSE_SAVED_TABS')).toBe(true)
      await expect.poll(() => readTabIds(cPage), { timeout: 5000 }).toEqual([])

      // --- close-all: all remaining tabs close ---
      await openSavedTabs(['final A\n', 'final B\n', 'final C\n'])
      ids = await readTabIds(cPage)
      expect(ids.length).toBeGreaterThanOrEqual(3)
      expect(await callEditorStoreAction(cPage, 'CLOSE_ALL_TABS')).toBe(true)
      await expect.poll(() => readTabIds(cPage), { timeout: 5000 }).toEqual([])
    } finally {
      await cApp.close()
    }
  })
})
