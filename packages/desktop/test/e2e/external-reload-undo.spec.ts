import { expect, test } from '@playwright/test'
import {
  launchWithMarkdown,
  waitForMenuReady,
  getMarkdownContent,
  sendIpcToRenderer,
  enterSourceMode
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

test.describe('External disk reload — source-mode scroll position survives a same-tab reload', () => {
  // Item 258: a same-id `mt::update-file` reload must not yank the CodeMirror
  // view back to the top. sourceCode.vue handleFileChange snapshots every
  // plausible scroll element on `isSameTabReload`, runs `editor.setValue`, then
  // re-applies the captured scrollTop synchronously, on nextTick, and on the
  // next animation frame (because the muya editor.vue file-changed handler
  // relayouts in the same tick). With `muyaIndexCursor: null` on a freshly
  // loaded tab the restore branch — not setSelection — is the one that runs.
  test('258: same-id reload preserves the source-mode scrollTop', async() => {
    // A long body so the CodeMirror content overflows and is actually
    // scrollable. The exact scroll element depends on CodeMirror's height:auto
    // + the outer .source-code overflow:auto interplay, so we discover whichever
    // element holds the scroll rather than assuming.
    const longBody = 'line\n'.repeat(400)
    const { app, page, filePath } = await launchWithMarkdown(longBody)
    await waitForMenuReady(app)

    // Auto-reload only applies silently when autoSave is on AND the tab is
    // unmodified (a freshly-loaded tab is saved) — same gate as the undo test.
    await sendIpcToRenderer(app, 'mt::user-preference', { autoSave: true })
    await page.waitForTimeout(100)

    await enterSourceMode(page, app)

    // Scroll well down the document. Drive both CodeMirror's own API and the
    // outer .source-code container so the scroll lands on whichever element is
    // the real overflow owner.
    const captured = await page.evaluate(() => {
      const container = document.querySelector('.source-code') as HTMLElement | null
      const cmEl = document.querySelector('.source-code .CodeMirror') as
        | (Element & {
          CodeMirror?: {
            scrollTo(x: number, y: number): void
            getScrollerElement(): HTMLElement
          }
        })
        | null
      const cm = cmEl?.CodeMirror
      if (cm) cm.scrollTo(0, 4000)
      if (container) container.scrollTop = 4000
      const scroller = cm?.getScrollerElement?.() ?? null
      return {
        container: container ? container.scrollTop : 0,
        scroller: scroller ? scroller.scrollTop : 0
      }
    })

    // At least one of the candidate elements must have actually scrolled,
    // otherwise the assertion below would be vacuous.
    const maxCaptured = Math.max(captured.container, captured.scroller)
    expect(maxCaptured).toBeGreaterThan(0)

    // Fire a same-tab external reload with slightly different long content. The
    // body must still match what we hand `loadChange` so the tab stays clean and
    // the reload applies silently.
    const reloadedBody = longBody + 'tail line\n'
    await reportExternalChange(app, filePath, reloadedBody)
    await page.waitForTimeout(600)

    // The reload landed (content updated) and CodeMirror is still mounted.
    expect((await getMarkdownContent(page, app)).trim().endsWith('tail line')).toBe(true)
    await enterSourceMode(page, app)

    // The scroll position is restored — not reset to the top. The exact pixel
    // value can drift slightly because the new (longer) content changes layout
    // height, so use a generous tolerance but require it to stay well away from
    // 0. We compare against whichever element actually owned the scroll.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const container = document.querySelector('.source-code') as HTMLElement | null
            const cmEl = document.querySelector('.source-code .CodeMirror') as
              | (Element & { CodeMirror?: { getScrollerElement(): HTMLElement } })
              | null
            const scroller = cmEl?.CodeMirror?.getScrollerElement?.() ?? null
            return Math.max(container ? container.scrollTop : 0, scroller ? scroller.scrollTop : 0)
          }),
        { timeout: 4000 }
      )
      .toBeGreaterThan(maxCaptured * 0.5)
    await app.close()
  })
})
