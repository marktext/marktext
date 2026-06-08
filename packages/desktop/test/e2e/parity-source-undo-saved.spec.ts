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
  // ACCEPT-DEFER: on source-mode exit the engine rebuilds the document via
  // setContent (which does NOT record an undo op) then restores the pre-source
  // op stack, so the bulk source-mode change is not a single undo boundary.
  // Recording it as one boundary would require feeding a general
  // whole-document json1 diff through Editor.updateContents' pick/drop walker,
  // which only handles specific op shapes (block insert / text edit /
  // checked|meta) and would risk corrupting the document on arbitrary diffs.
  // Left as `test.fail()` — see the matching note in editor.vue handleFileChange.
  test.fail()
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
