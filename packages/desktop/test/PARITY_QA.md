# Parity manual-QA checklist (muyajs → @muyajs/core)

Some parity gaps from the desktop migration to `@muyajs/core` (PR #4406) cannot
be exercised reliably in a headless / xvfb CI run — they need a real OS
clipboard with bitmap data, a real drag-and-drop gesture, or the native
screenshot tool. They are tracked here as precise manual checklists instead of
automated tests.

Run these on a packaged or `pnpm run dev` build. Each entry maps to a row in
[`PARITY_SCOREBOARD.md`](./PARITY_SCOREBOARD.md). When a fix lands, perform the
steps; the entry passes when the **Expected (after fix)** result is observed.

> Every entry currently FAILS on `develop` (the gap is present). That is the
> point of the scoreboard — these are the regressions the fix PRs must close.

---

## PG4 — Drag-and-drop image insertion (local file + web link)

**What is now automated:** the engine drag-drop handler is restored and unit
tested in `packages/muya/src/editor/__tests__/dragDropImage.spec.ts` (PG4).
happy-dom provides a fully working `DataTransfer` (`items.add` / `getAsString` /
`files`) and fires `getAsString` synchronously, so a synthetic `drop` event
drives the real handler end-to-end. The spec asserts both drop paths against the
live handler: a dropped local image FILE inserts a `![loading-id](path)`
placeholder and invokes the `imageAction` hook with `{ src, alt, title }`; a
dropped web-link image (`text/uri-list`) inserts `![](url)`; and a drop outside
an editor content block is a no-op.

**Why this part stays manual:** the unit test mocks the embedder hooks
(`getPathForFile` / `imageAction`). It cannot exercise a genuine OS-level file
drop from the file manager, Electron's real `webUtils.getPathForFile`, or the
desktop assets-folder / upload persistence behind `imageAction`. Verify those by
hand:

### Steps — local image file
1. Open a document (ideally a saved `.md` so assets-folder behaviour applies).
2. From the OS file manager, drag a `.png` / `.jpg` file over the editor body
   and drop it inside a paragraph.

**Expected (after fix):** a loading placeholder appears, then an inline image
renders. With `Preferences → Image → insert action = "copy to folder"` the file
is copied into the document's assets folder and the link points there (not the
original absolute path).

> Requires the desktop wave-2 wiring (see below): the engine `imageAction` /
> `getPathForFile` options must be passed when constructing Muya in
> `editor.vue`. Without that wiring the drop inserts the raw path verbatim and
> the insert-action preference is ignored.

### Steps — web-link image
1. In a browser, drag an image (or its URL) over the editor and drop it.

**Expected (after fix):** `![](<url>)` is inserted and the image renders. (This
path needs no desktop wiring — it works as soon as the engine handler ships.)

### Desktop wave-2 wiring required
The engine now reads two new `IMuyaOptions` hooks for the local-file path:
`imageAction({ src, alt, title }) => Promise<string>` (persist per insert
preference) and `getPathForFile(file) => string` (resolve a dropped `File` to a
path). `editor.vue` already defines `muyaImageAction` and uses
`window.electron.webUtils.getPathForFile` elsewhere — pass them into the Muya
constructor `options` so the dropped-file path is persisted and resolvable.

---

## PG5 — Binary/bitmap clipboard image paste (screenshot, browser "Copy Image")

**Why manual:** this needs a real bitmap on the OS clipboard (no file path). The
engine-unit half — that a synthetic `clipboardData.files` PNG is read into a
base64 `data:` URL and persisted via `imageAction` — is now **implemented and
passing** in
`packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (PG5; the
`it.fails` marker is removed). The full OS-clipboard + macOS `screencapture`
integration can only be verified by hand and stays manual.

### Steps — browser "Copy Image"
1. In a browser, right-click an image → **Copy Image** (puts a bitmap, not a
   file path, on the clipboard).
2. Focus the editor and paste (Cmd/Ctrl+V).

**Expected (after fix):** the bitmap is inserted as an inline image and
persisted per the insert-action preference.

**Current (gap):** nothing is inserted.

### Steps — macOS screenshot integration
1. macOS only. Trigger the in-app screenshot capture (Function/menu that runs
   `screencapture -i -c`), select a region.
2. The captured bitmap lands on the clipboard and the app auto-pastes it.

**Expected (after fix):** the screenshot is inserted as an inline image.

**Current (gap):** nothing is inserted — the screenshot-and-insert feature is
silently dead.

---

## Notes for fixers

- PG4 and PG5 both now have engine-unit regression tests that drive the real
  handler with a synthetic `DataTransfer`
  (`packages/muya/src/editor/__tests__/dragDropImage.spec.ts` for PG4,
  `packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` for PG5).
  These manual entries cover only the OS-integration / desktop-wiring parts the
  unit tests cannot reach (real OS file drop, `webUtils.getPathForFile`, the
  assets-folder/upload persistence behind `imageAction`, the OS clipboard, and
  the macOS `screencapture` integration).
- PG5's engine half is now closed: the binary-paste branch reads
  `clipboardData.files` → base64 `data:` URL → `imageAction`, and the
  regression test's `it.fails` is now a passing `it`. This manual entry covers
  only the desktop OS-clipboard delivery (real bitmap, macOS `screencapture`)
  the unit test cannot reach.
