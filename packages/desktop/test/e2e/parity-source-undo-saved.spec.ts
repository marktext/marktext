import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import {
  launchWithMarkdown,
  waitForMenuReady,
  enterSourceMode,
  exitSourceMode,
  setSourceMarkdown,
  sendIpcToRenderer,
  getMarkdownContent,
  typeIntoEditor,
  placeCaretInEditor
} from './helpers'

// PARITY SCOREBOARD — desktop gaps PG2 (file PG02), PG14 (file PG15),
// PG15 (file PG16).

// Trigger an editor undo through the same IPC channel the Edit › Undo menu item
// uses (`mt::editor-edit-action` → bus `undo` → editor.undo()). More reliable
// than synthesizing the Cmd/Ctrl+Z keystroke against the contenteditable.
const undo = async(app: Parameters<typeof sendIpcToRenderer>[0]): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
}

const redo = async(app: Parameters<typeof sendIpcToRenderer>[0]): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'redo')
}

test.describe('Parity PG2 — WYSIWYG caret restored after a source-mode edit', () => {
  // handleFileChange now maps the saved `muyaIndexCursor` ({line, ch}) onto a
  // block-key cursor via the engine's `setCursorByOffset`, so the source-mode
  // editing position is restored on the handoff back to WYSIWYG.
  test('PG2: the caret lands in the block the source-mode cursor was on', async() => {
    const { app, page } = await launchWithMarkdown(
      'first para\n\nsecond para\n\nthird para here\n'
    )
    await waitForMenuReady(app)

    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (
        document.querySelector('.source-code .CodeMirror') as Element & {
          CodeMirror: { setCursor(p: { line: number; ch: number }): void; focus(): void }
        }
      ).CodeMirror
      // Line 4 = "third para here"; place the source cursor inside it.
      cm.setCursor({ line: 4, ch: 6 })
      cm.focus()
    })
    await page.waitForTimeout(200)
    await exitSourceMode(page, app)
    await page.waitForTimeout(500)

    const enclosingText = await page.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return ''
      let node: Node | null = sel.getRangeAt(0).startContainer
      while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.matches('p, h1, h2, h3, li')) {
          return node.textContent || ''
        }
        node = node.parentNode
      }
      return ''
    })

    // Desired: the caret is restored into the "third para here" block.
    expect(enclosingText).toContain('third para')
    await app.close()
  })
})

test.describe('Parity PG14 — first undo after source mode reverts the edit in one step', () => {
  // FIXED: on source-mode exit, handleFileChange records the bulk change as a
  // SINGLE engine undo boundary via `Muya.replaceContent` (a fully-invertible
  // whole-document ot-json1 op applied through a full block-tree rebuild, never
  // the incremental pick/drop walker), so the first undo reverts the entire
  // source-mode edit in one step — matching legacy muyajs' full-state-snapshot
  // history. See the matching note in editor.vue handleFileChange and the
  // engine unit coverage in packages/muya/src/__tests__/replaceContent.spec.ts.
  test('PG14: one undo after exiting source mode reverts the source-mode change', async() => {
    const { app, page } = await launchWithMarkdown('base\n')
    await waitForMenuReady(app)

    // Bulk source-mode edit.
    await setSourceMarkdown(page, app, 'base\n\nSOURCE ADDED LINE\n')
    await page.waitForTimeout(500)
    expect((await getMarkdownContent(page, app)).trim()).toContain('SOURCE ADDED LINE')

    // First undo after the source-mode handoff.
    await undo(app)
    await page.waitForTimeout(600)

    // Desired: the document reverts to the exact pre-source-mode content in a
    // single undo step.
    expect((await getMarkdownContent(page, app)).trim()).toBe('base')
    await app.close()
  })

  test('PG14: redo re-applies the source-mode change in one step', async() => {
    const { app, page } = await launchWithMarkdown('base\n')
    await waitForMenuReady(app)

    await setSourceMarkdown(page, app, 'base\n\nSOURCE ADDED LINE\n')
    await page.waitForTimeout(500)

    await undo(app)
    await page.waitForTimeout(600)
    expect((await getMarkdownContent(page, app)).trim()).toBe('base')

    // Redo restores the entire bulk change in one step.
    await redo(app)
    await page.waitForTimeout(600)
    expect((await getMarkdownContent(page, app)).trim()).toContain('SOURCE ADDED LINE')
    await app.close()
  })

  test('PG14: a block-type bulk change reverts in one undo step', async() => {
    const { app, page } = await launchWithMarkdown('hello\n')
    await waitForMenuReady(app)

    // Convert a paragraph into a heading + add a list — an arbitrary
    // whole-document change (the corruption-risk surface the incremental walker
    // could not handle). The single undo must restore the exact paragraph.
    await setSourceMarkdown(page, app, '# hello\n\n- new item\n')
    await page.waitForTimeout(500)
    expect((await getMarkdownContent(page, app)).trim()).toContain('# hello')

    await undo(app)
    await page.waitForTimeout(600)
    expect((await getMarkdownContent(page, app)).trim()).toBe('hello')
    await app.close()
  })
})

test.describe('Parity PG15 — undo back to on-disk content restores the saved indicator', () => {
  // The synthetic save-tracking id is a MONOTONIC, never-reused id keyed on the
  // live document content (see `syntheticHistory.ts`). A freshly-loaded tab seeds
  // `lastSavedHistoryId` to the baseline (id 0); undoing an edit back to disk
  // content reproduces the baseline content and hence the saved id, restoring the
  // saved/clean indicator.
  test('PG15: undoing an edit back to disk content clears the unsaved indicator', async() => {
    const { app, page } = await launchWithMarkdown('hello world\n')
    await waitForMenuReady(app)

    await placeCaretInEditor(page)
    await typeIntoEditor(page, ' EXTRA')
    await page.waitForTimeout(500)

    // Sanity: the edit dirtied the tab and changed the content.
    expect(await page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))).toBe(true)
    expect((await getMarkdownContent(page, app)).trim()).toContain('EXTRA')

    // Undo back to the on-disk content.
    await undo(app)
    await page.waitForTimeout(600)
    // Content is restored to disk...
    expect((await getMarkdownContent(page, app)).trim()).toBe('hello world')

    // ...and the saved/clean indicator comes back (tab no longer marked
    // unsaved). Poll: the indicator clears on the undo's async json-change.
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved')))
      .toBe(false)
    await app.close()
  })

  // G6: the saved/clean indicator must NOT falsely show clean after
  // undo + a divergent re-edit returns the engine undo-stack to the saved DEPTH.
  // With the old depth-as-id scheme the id collided with the saved id and the
  // dirty tab read as clean (risking data loss on close-without-save). The
  // monotonic content-keyed id keeps the divergent document dirty.
  test('G6: a divergent re-edit at the saved undo depth stays dirty', async() => {
    const { app, page } = await launchWithMarkdown('A\n')
    await waitForMenuReady(app)

    // Edit to A + B, then mark the tab saved at this state (same IPC channel the
    // main process sends after a real save: records the current synthetic id as
    // `lastSavedHistoryId` and clears the dirty flag).
    await placeCaretInEditor(page)
    await typeIntoEditor(page, ' B')
    await page.waitForTimeout(500)
    const tabId = await page.evaluate(
      () => document.querySelector('.editor-tabs li.active')?.getAttribute('data-id') ?? null
    )
    expect(tabId).toBeTruthy()
    await sendIpcToRenderer(app, 'mt::tab-saved', tabId)
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved')))
      .toBe(false)

    // Undo B (back to 'A', dirty), then make a DIFFERENT edit C. The engine undo
    // depth returns to the saved depth, but the document is A + C != saved A + B.
    await undo(app)
    await page.waitForTimeout(400)
    await typeIntoEditor(page, ' C')
    await page.waitForTimeout(500)

    // The divergent document must stay dirty (the G6 false-clean regression).
    const content = (await getMarkdownContent(page, app)).trim()
    expect(content).toContain('C')
    expect(content).not.toContain('B')
    const dirty = await page.evaluate(
      () => !!document.querySelector('.editor-tabs li.unsaved')
    )
    expect(dirty).toBe(true)
    await app.close()
  })
})

const isTabDirty = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))

const activeTabId = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('.editor-tabs li.active')?.getAttribute('data-id') ?? null
  )

// Read the live WYSIWYG document text WITHOUT toggling source mode. Toggling
// into/out of source mode (as getMarkdownContent does) pushes extra
// `replaceContent` undo boundaries, which would desync an undo-count assertion;
// reading the rendered paragraphs directly keeps the engine undo stack clean.
const wysiwygText = (page: Page): Promise<string> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-component span.mu-paragraph-content'))
      .map((el) => (el.textContent ?? '').replace(/\u00a0/g, ' ').trim())
      .filter((t) => t.length > 0)
      .join('\n')
  )

test.describe('Item 248 — a real source-mode keystroke dirties the tab dot', () => {
  // A bulk `setSourceMarkdown` replace is already covered by PG14. The dirty-dot
  // path driven by an actual CodeMirror keystroke is NOT — drive a real character
  // insert through the live CodeMirror instance so cursorActivity fires, then
  // assert the tab is marked `.unsaved` and the typed text survives the handoff
  // back to WYSIWYG.
  //
  // Timing note (verified against the real build): source mode's `cursorActivity`
  // -> saveContent -> LISTEN_FOR_CONTENT_CHANGE only refreshes markdown/cursor; it
  // does NOT touch the synthetic history stack the dirty condition keys off, so
  // the dot stays clean WHILE in source mode. The edit becomes a dirtying history
  // boundary on the source->WYSIWYG handoff (editor.vue handleFileChange ->
  // replaceContent), so the `.unsaved` dot appears right after exit.
  test('typing in source mode marks the tab unsaved and the text survives exit', async() => {
    const { app, page } = await launchWithMarkdown('saved baseline\n')
    await waitForMenuReady(app)

    // Freshly-loaded saved doc: no dirty dot yet.
    expect(await isTabDirty(page)).toBe(false)

    await enterSourceMode(page, app)

    // Drive a REAL keystroke into CodeMirror (not the bulk setValue path):
    // focus, place the caret at the line end, and insert characters so the
    // `cursorActivity` listener runs.
    await page.evaluate(() => {
      const cm = (
        document.querySelector('.source-code .CodeMirror') as Element & {
          CodeMirror: {
            focus(): void
            setCursor(p: { line: number; ch: number }): void
            replaceSelection(text: string): void
          }
        }
      ).CodeMirror
      cm.focus()
      cm.setCursor({ line: 0, ch: 'saved baseline'.length })
      cm.replaceSelection(' SRCKEY')
    })

    // The CodeMirror value reflects the typed text while still in source mode.
    const sourceValue = await page.evaluate(() => {
      const cm = (
        document.querySelector('.source-code .CodeMirror') as Element & {
          CodeMirror: { getValue(): string }
        }
      ).CodeMirror
      return cm.getValue()
    })
    expect(sourceValue).toContain('saved baseline SRCKEY')

    // Hand off back to WYSIWYG: the edit becomes a dirtying history boundary, so
    // the active tab gains `.unsaved`, and the typed text survives the round trip.
    await exitSourceMode(page, app)
    await expect.poll(() => isTabDirty(page)).toBe(true)
    await expect
      .poll(() => getMarkdownContent(page, app).then((md) => md.trim()))
      .toContain('saved baseline SRCKEY')
    await app.close()
  })
})

test.describe('Item 256 — save -> clean -> edit -> dirty -> undo-to-saved cycle', () => {
  // A focused save/clean/edit/dirty loop. The G6 test only USES mt::tab-saved as
  // a setup step; there is no standalone assertion that a real save clears the
  // dot, that a fresh edit re-marks it, and that undoing back to the saved state
  // clears it again. This exercises the full content-keyed synthetic-history
  // round trip the save indicator relies on.
  test('a save clears the dot, a new edit re-marks it, and undo-to-saved clears it', async() => {
    const { app, page } = await launchWithMarkdown('hello world\n')
    await waitForMenuReady(app)

    // Freshly-loaded saved doc: no dirty dot yet.
    expect(await isTabDirty(page)).toBe(false)

    // 1) Edit to dirty the tab. Let the type fully commit as its own engine undo
    //    boundary before sealing it (a too-early follow-up edit/undo can collapse
    //    adjacent types into one step and overshoot the saved state).
    await placeCaretInEditor(page)
    await typeIntoEditor(page, ' EXTRA')
    await expect.poll(() => isTabDirty(page)).toBe(true)
    await page.waitForTimeout(400)

    // Seal the EXTRA edit as a distinct committed undo boundary by round-tripping
    // through source mode (the handoff records a single replaceContent boundary).
    // Without this the engine groups the later "MORE" type with the EXTRA type
    // into one undo step, so there would be no SAVED state distinct from the
    // on-disk baseline to undo back to.
    await getMarkdownContent(page, app)
    await page.waitForTimeout(400)
    await expect.poll(() => wysiwygText(page)).toContain('EXTRA')
    // Capture the saved-state text so the undo assertion compares against the
    // engine's exact rendered form.
    const savedText = await wysiwygText(page)

    // 2) Real save (same IPC the main process sends after writing to disk):
    //    records the current synthetic id as lastSavedHistoryId and clears dirty.
    const tabId = await activeTabId(page)
    expect(tabId).toBeTruthy()
    await sendIpcToRenderer(app, 'mt::tab-saved', tabId)
    await expect.poll(() => isTabDirty(page)).toBe(false)

    // 3) A fresh edit past the saved state re-marks the tab dirty.
    await placeCaretInEditor(page)
    await typeIntoEditor(page, ' MORE')
    await expect.poll(() => isTabDirty(page)).toBe(true)
    await expect.poll(() => wysiwygText(page)).toBe(`${savedText}\nMORE`)
    await page.waitForTimeout(400)

    // 4) Undo the MORE edit, landing back on the saved EXTRA content. The dot
    //    clears again because the restored content reproduces the SAVED synthetic
    //    id (content-keyed monotonic history) — NOT merely the on-disk baseline.
    //    This is the full save->clean->edit->dirty->undo-to-saved loop.
    await undo(app)
    await expect.poll(() => wysiwygText(page)).toBe(savedText)
    await expect.poll(() => isTabDirty(page)).toBe(false)
    await app.close()
  })
})
