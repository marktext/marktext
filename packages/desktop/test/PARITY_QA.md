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

**Why manual:** drag-and-drop needs a real `DataTransfer` with `files` /
`text/uri-list` and a genuine drop gesture over the editor; Playwright/Electron
cannot synthesize an OS-level file drop into the contenteditable reliably.

### Steps — local image file
1. Open a document (ideally a saved `.md` so assets-folder behaviour applies).
2. From the OS file manager, drag a `.png` / `.jpg` file over the editor body
   and drop it inside a paragraph.

**Expected (after fix):** a loading placeholder appears, then an inline image
renders. With `Preferences → Image → insert action = "copy to folder"` the file
is copied into the document's assets folder and the link points there (not the
original absolute path).

**Current (gap):** nothing is inserted — the drop is a no-op.

### Steps — web-link image
1. In a browser, drag an image (or its URL) over the editor and drop it.

**Expected (after fix):** `![](<url>)` is inserted and the image renders.

**Current (gap):** nothing is inserted.

---

## PG5 — Binary/bitmap clipboard image paste (screenshot, browser "Copy Image")

**Why manual:** this needs a real bitmap on the OS clipboard (no file path). The
engine-unit half — that a synthetic `clipboardData.files` PNG is persisted via
`imageAction` — is covered in
`packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (PG5). The full
OS-clipboard + macOS `screencapture` integration can only be verified by hand.

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

- After closing PG4 / PG5, consider adding a Playwright spec that drives the
  engine paste/drop handler with a synthetic `DataTransfer` where the platform
  allows it, and keep this manual entry only for the OS-integration parts that
  remain un-automatable.
- PG5 already has an engine-unit regression test; closing the engine half flips
  that `it.fails` to passing. This manual entry covers the desktop OS-clipboard
  delivery the unit test cannot reach.
