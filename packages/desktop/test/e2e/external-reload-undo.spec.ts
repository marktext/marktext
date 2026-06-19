import { expect, test } from '@playwright/test'
import {
  launchWithMarkdown,
  waitForMenuReady,
  getMarkdownContent,
  sendIpcToRenderer
} from './helpers'

// Trigger an editor undo through the same IPC channel the Edit › Undo menu item
// uses (`mt::editor-edit-action` → bus `undo` → editor.undo()).
const undo = async(app: Parameters<typeof sendIpcToRenderer>[0]): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
}

// Reproduce the watcher's external-change report: the same `mt::update-file`
// payload shape the main-process watcher sends (a `loadMarkdownFile` result in
// `change.data`). Drives the real renderer reload path
// LISTEN_FOR_FILE_CHANGE → loadChange → bus `file-changed` → handleFileChange.
const reportExternalChange = async(
  app: Parameters<typeof sendIpcToRenderer>[0],
  pathname: string,
  markdown: string
): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::update-file', {
    type: 'change',
    change: {
      pathname,
      mtimeMs: 1,
      data: {
        markdown,
        filename: 'note.md',
        pathname,
        encoding: { encoding: 'utf8', hasBOM: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 1,
        isMixedLineEndings: false
      }
    }
  })
}

test.describe('External disk reload — undo restores the pre-change document', () => {
  // Legacy muyajs kept a full-state snapshot of the pre-reload document so the
  // first Ctrl+Z after an external reload restored it. The @muyajs/core reload
  // path must record the same single invertible undo boundary (via
  // `Muya.replaceContent`) instead of `setContent` (which clears history).
  test('first undo after an external reload restores the old content', async() => {
    const { app, page, filePath } = await launchWithMarkdown('old content here\n')
    await waitForMenuReady(app)

    // Auto-reload only applies silently when autoSave is on AND the tab is
    // unmodified (a freshly-loaded tab is saved). Enable autoSave so the change
    // applies without the manual "Reload" confirmation prompt.
    await sendIpcToRenderer(app, 'mt::user-preference', { autoSave: true })
    await page.waitForTimeout(100)

    await reportExternalChange(app, filePath, 'new content here\n')
    await page.waitForTimeout(600)

    // The tab now reflects the new on-disk content...
    expect((await getMarkdownContent(page, app)).trim()).toBe('new content here')
    // ...and stays clean: the reloaded content matches the file on disk, so the
    // tab must NOT be flagged unsaved (replaceContent fires a json-change that
    // would otherwise mark it dirty against the stale baseline).
    expect(await page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved'))).toBe(
      false
    )

    // The first undo reverts the external change in one step, back to the
    // document as it was before the reload.
    await undo(app)
    await page.waitForTimeout(600)
    expect((await getMarkdownContent(page, app)).trim()).toBe('old content here')
    // The undone document now diverges from on-disk content, so the tab is dirty.
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.editor-tabs li.unsaved')))
      .toBe(true)
    await app.close()
  })
})
