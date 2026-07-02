import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import {
  launchWithMarkdown,
  waitForMenuReady,
  enterSourceMode,
  sendIpcToRenderer
} from './helpers'

// Issue #781 — Undo/redo while in Source Code mode must act on the CodeMirror
// editor, not the hidden WYSIWYG (muya) engine. The Edit › Undo menu item and
// Cmd/Ctrl+Z both route through `mt::editor-edit-action` → bus `undo`. Before the
// fix only editor.vue subscribed and called muya.undo() (invisible in source
// mode), so undo did nothing. sourceCode.vue now also subscribes and runs
// CodeMirror's `undo`/`redo` command, and editor.vue's handler bails out while
// source mode is active.

const cmValue = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const cm = (
      document.querySelector('.source-code .CodeMirror') as Element & {
        CodeMirror: { getValue(): string }
      }
    ).CodeMirror
    return cm.getValue()
  })

const typeInCm = (page: Page, text: string): Promise<void> =>
  page.evaluate((t) => {
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
    cm.replaceSelection(t)
  }, text)

const undo = (app: Parameters<typeof sendIpcToRenderer>[0]): Promise<void> =>
  sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
const redo = (app: Parameters<typeof sendIpcToRenderer>[0]): Promise<void> =>
  sendIpcToRenderer(app, 'mt::editor-edit-action', 'redo')

test.describe('Issue #781 — undo/redo in source code mode', () => {
  test('undo reverts a source-mode edit; redo re-applies it', async() => {
    const { app, page } = await launchWithMarkdown('saved baseline\n')
    await waitForMenuReady(app)

    await enterSourceMode(page, app)
    const baseline = await cmValue(page)

    // A single CodeMirror edit (one undo step).
    await typeInCm(page, ' SRCKEY')
    expect(await cmValue(page)).toContain('saved baseline SRCKEY')

    // Undo through the same IPC the Edit › Undo menu uses — must hit CodeMirror.
    await undo(app)
    await expect.poll(() => cmValue(page)).toBe(baseline)

    // Redo restores the edit.
    await redo(app)
    await expect.poll(() => cmValue(page)).toContain('saved baseline SRCKEY')

    await app.close()
  })
})
