import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  launchWithDoc,
  waitForMenuReady,
  enterSourceMode,
  exitSourceMode,
  getMarkdownContent,
  setSourceMarkdown,
  sendIpcToRenderer
} from './helpers'

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 39). A single desktop document combining
// every block type round-trips byte-stable across repeated source <-> WYSIWYG
// toggles and a real on-disk save, with no false-dirty / reformat.
//
// Basic round-trip + the modified indicator are each covered in isolation
// (editor-input.spec.ts, parity-source-undo-saved.spec.ts), and per-fixture
// DOM render is covered by fixture-render.spec.ts. Engine-level byte stability
// is covered in packages/muya/test/spec/roundTrip.spec.ts. The MISSING slice
// is one desktop doc with all block types + the full desktop save path:
//   editor (loaded with a real file) -> Cmd/Ctrl+S (mt::editor-ask-file-save)
//   -> store FILE_SAVE -> mt::response-file-save -> main writeMarkdownFile
//   -> mt::tab-saved -> the tab's unsaved dot clears.
//
// The fixture lives at test/e2e/data/all-blocks.md. It is written in the
// engine's canonical serialized form (default desktop prefs: listIndentation 1,
// preferLooseListItem, ATX headings, fenced code, GitHub tables) so that a
// load -> serialize round trip is the identity (modulo the trailing newline
// the serializer always emits — the fixture already ends with one).
// ---------------------------------------------------------------------------

const FIXTURE_REL = 'test/e2e/data/all-blocks.md'
// launchWithDoc passes the fixture as an Electron CLI arg resolved against the
// desktop package root (cwd). helpers.ts sets projectRoot to packages/desktop.
const FIXTURE_ABS = path.resolve(__dirname, 'data', 'all-blocks.md')

const UNSAVED_DOT = '.editor-tabs li.unsaved'

// Trigger the desktop save through the exact IPC channel the File > Save menu
// item sends (`mt::editor-ask-file-save` -> store FILE_SAVE). The file was
// opened from a real path so main takes the alreadyExistOnDisk branch: it
// writes the markdown to disk and replies `mt::tab-saved`, clearing the dot.
const save = async(app: ElectronApplication): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
}

const readDisk = (): string => fs.readFileSync(FIXTURE_ABS, 'utf-8')

const isDirty = (page: Page): Promise<boolean> =>
  page.evaluate((sel) => !!document.querySelector(sel), UNSAVED_DOT)

test.describe('All blocks round-trip + save byte-stability (item 39)', () => {
  let app: ElectronApplication
  let page: Page
  let original: string

  test.beforeAll(async() => {
    // Snapshot the on-disk bytes BEFORE launching so we can restore them in
    // afterAll (the test saves into the real fixture file) and so we have the
    // exact baseline to compare the serialized + saved content against.
    original = readDisk()
    const launched = await launchWithDoc(FIXTURE_REL)
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    // Let muya finish the initial render of every block.
    await page.waitForTimeout(800)
  })

  test.afterAll(async() => {
    if (app) await app.close()
    // Restore the fixture to its original bytes regardless of test outcome so
    // the working tree is left untouched.
    try {
      fs.writeFileSync(FIXTURE_ABS, original, 'utf-8')
    } catch {
      /* ignore */
    }
  })

  test('every block type renders (sanity that the fixture loaded)', async() => {
    // Front matter + the structural block types are all present in the DOM.
    await page.waitForSelector('.editor-component h1', { state: 'attached', timeout: 10000 })
    const counts = await page.evaluate(() => {
      const root = document.querySelector('.editor-component') as HTMLElement
      const q = (s: string): number => root.querySelectorAll(s).length
      return {
        h1: q('h1'),
        h2: q('h2'),
        blockquote: q('blockquote'),
        ul: q('ul'),
        ol: q('ol'),
        task: q('input[type="checkbox"]'),
        table: q('table'),
        code: q('pre.mu-container-block, .mu-code-block, pre'),
        link: q('.mu-link[href], a[href]')
      }
    })
    expect(counts.h1).toBeGreaterThanOrEqual(1)
    expect(counts.h2).toBeGreaterThanOrEqual(1)
    expect(counts.blockquote).toBeGreaterThanOrEqual(1)
    expect(counts.ul).toBeGreaterThanOrEqual(1)
    expect(counts.ol).toBeGreaterThanOrEqual(1)
    expect(counts.task).toBeGreaterThanOrEqual(2)
    expect(counts.table).toBeGreaterThanOrEqual(1)
    expect(counts.code).toBeGreaterThanOrEqual(1)
    expect(counts.link).toBeGreaterThanOrEqual(1)
  })

  test('the freshly loaded doc is clean and serializes back to the original bytes', async() => {
    // A freshly opened (unedited) file must not be marked dirty.
    expect(await isDirty(page)).toBe(false)

    // The engine's serialization of the loaded document equals the on-disk
    // bytes — i.e. the fixture is already in canonical form, so loading it does
    // not silently reformat anything.
    const serialized = await getMarkdownContent(page, app)
    expect(serialized).toBe(original)
  })

  test('repeated source <-> WYSIWYG toggles do not mutate or reformat the content', async() => {
    // Toggle source mode in and out twice; the content must be identical after
    // each handoff and must never diverge from the original.
    for (let i = 0; i < 2; i++) {
      await enterSourceMode(page, app)
      const inSource = await page.evaluate(() => {
        const cm = document.querySelector('.source-code .CodeMirror') as
          | (Element & { CodeMirror?: { getValue(): string } })
          | null
        return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : null
      })
      expect(inSource).toBe(original)
      await exitSourceMode(page, app)
      await page.waitForTimeout(200)
    }

    const afterToggles = await getMarkdownContent(page, app)
    expect(afterToggles).toBe(original)
  })

  test('saving clears the unsaved indicator and writes the original bytes back to disk', async() => {
    // The toggles above should not have dirtied the tab, but a pure round trip
    // can legitimately leave the tab clean; either way, force a save and verify
    // the post-save state is clean and the on-disk bytes are unchanged.
    await save(app)

    // The saved/clean indicator is set on the async mt::tab-saved reply.
    await expect.poll(() => isDirty(page), { timeout: 5000 }).toBe(false)

    // The bytes written to disk equal the original fixture (no reformat on
    // save). Poll because the disk write is async on the main side.
    await expect.poll(() => readDisk(), { timeout: 5000 }).toBe(original)

    // And the in-editor serialization still matches.
    expect(await getMarkdownContent(page, app)).toBe(original)
  })

  test('a dirty edit saves through the full IPC path and persists the exact editor serialization', async() => {
    // Genuinely exercise the dirty -> save -> clean transition (test 4 may have
    // saved an already-clean tab). A bulk source-mode edit that appends a
    // paragraph dirties the tab; confirm the unsaved dot appears.
    await setSourceMarkdown(page, app, original + '\nDIRTY EXTRA PARAGRAPH\n')
    await expect.poll(() => isDirty(page), { timeout: 5000 }).toBe(true)

    // What the editor will persist is its own serialization of the current
    // document (store FILE_SAVE sends currentFile.markdown). Capture it, then
    // save and verify the on-disk bytes match it exactly (the desktop save path
    // does not reformat on top of the editor's serialization).
    const editorContent = await getMarkdownContent(page, app)
    expect(editorContent).toContain('DIRTY EXTRA PARAGRAPH')

    await save(app)
    await expect.poll(() => isDirty(page), { timeout: 5000 }).toBe(false)
    await expect.poll(() => readDisk(), { timeout: 5000 }).toBe(editorContent)
  })
})
