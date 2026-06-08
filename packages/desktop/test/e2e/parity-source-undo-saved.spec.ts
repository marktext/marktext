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
  // handleFileChange drops `muyaIndexCursor`/`blocks` and the engine has no
  // index→path cursor conversion, so the source-mode editing position is lost
  // on the handoff back to WYSIWYG and no meaningful caret is restored.
  test.fail()
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
  // On source-mode exit the engine rebuilds the document via setContent (which
  // does NOT record an undo op) then restores the pre-source op stack, so the
  // bulk source-mode change is not a single undo boundary.
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
  // The desktop feeds the store a synthetic history whose id is regenerated on
  // every json-change (including undo), so the saved-id comparison never
  // matches again and the tab stays marked dirty even when content == disk.
  test.fail()
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
