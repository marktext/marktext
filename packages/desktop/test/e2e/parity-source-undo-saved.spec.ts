import { expect, test } from '@playwright/test'
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
// PG15 (file PG16). Each RUNS headless but currently fails, so each is marked
// `test.fail()`. When the corresponding fix lands, remove the `test.fail()`.

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
  // The synthetic save-tracking id is now the engine undo-stack depth (a stable
  // position marker), and a freshly-loaded tab seeds `lastSavedHistoryId` to the
  // baseline depth (0). Undoing an edit back to disk content returns the id to
  // its saved value, so the saved/clean indicator is restored.
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

    // Desired: ...and the saved/clean indicator comes back (tab no longer
    // marked unsaved). Today the tab stays dirty.
    const stillUnsaved = await page.evaluate(
      () => !!document.querySelector('.editor-tabs li.unsaved')
    )
    expect(stillUnsaved).toBe(false)
    await app.close()
  })
})
