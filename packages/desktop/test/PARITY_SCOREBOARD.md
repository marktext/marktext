# Parity scoreboard — muyajs → @muyajs/core (PR #4406 follow-ups)

This is a **failing-test scoreboard**. The desktop app migrated from the legacy
`packages/muyajs` engine to `@muyajs/core` (`packages/muya`) in PR #4406. That
migration left **15 confirmed functional-parity gaps**. This board encoded each
one as a regression test that *failed on `develop`* (proving the gap), marked as
an *expected failure* so the suites stayed GREEN. **14 of the 15 are now fixed**
(seven Wave-1 engine PRs #4408–#4414 + the Wave-2 desktop consumer wiring); the
xfail markers were removed as each landed and the tests now assert the correct
behaviour directly. **PG14 alone remains xfail** (accept-defer — see its row).

## How it works

The board started fully xfail and is now almost entirely flipped to real
assertions (only PG14 remains xfail). The mechanism, for the one remaining gap
and any future ones:

- **muya engine unit tests** (`packages/muya/src/**/__tests__/parity*.spec.ts`)
  used vitest `it.fails(...)`: the assertion describes the correct
  (pre-migration) behaviour and failed pre-fix, which vitest counts as a *pass*.
  When a fix lands and the behaviour becomes correct, `it.fails` then **errors**
  — forcing the fixer to delete `.fails`. All engine parity specs now use plain
  `it` and pass.
- **desktop e2e tests** (`packages/desktop/test/e2e/parity-*.spec.ts`) use
  Playwright `test.fail()`: the test runs headless and fails pre-fix, which
  Playwright counts as a *pass*. When the fix lands, remove `test.fail()`. Only
  PG14 still carries it.
- **manual-QA** entries (`packages/desktop/test/PARITY_QA.md`) cover gaps that
  cannot be driven headless (real OS clipboard bitmaps, drag-and-drop gestures).

**Every test name starts with its gap id** (`PG3: …`) so a fix PR can
`grep -rn "PG3:"` to find and flip its entry.

## Flipping a gap to green (for fix PRs)

1. Implement the fix.
2. `grep -rn "PGn:"` to locate the test(s).
3. Remove the `it.fails` → `it` (muya) or delete `test.fail()` (desktop e2e),
   or run + check off the manual-QA entry.
4. Confirm the test now PASSES, update the **Status** column here to ✅.

## Scoreboard

> **Gaps remaining: 1 / 15** (PG14, accept-defer). The other 14 are closed:
> the seven Wave-1 engine PRs (#4408–#4414) landed the engine halves, and the
> Wave-2 desktop PR wired the consumers (PG1 affiliation adapter, PG2
> `setCursorByOffset`, PG8 pdf.ts slugger, PG9 `copyAsRich` map, PG11
> `heading-copy-link` subscription, PG15 stable saved-id). PG4's local-file
> drag-drop persistence and PG5's OS-clipboard bitmap delivery still have
> manual-QA entries in `PARITY_QA.md` (cannot be driven headless), but their
> code paths are fixed and unit-tested. PG14 (single-undo-boundary across the
> source-mode handoff) is deferred — see its row.

| Gap | Severity | Behaviour lost | Test location(s) | Mechanism | Status |
|-----|----------|----------------|------------------|-----------|--------|
| **PG1** | major | `selection-change` lacks block affiliation / ancestor type → native Paragraph & Format menu state is dead | `packages/muya/src/selection/__tests__/paritySelectionChange.spec.ts` (`PG1:` ×2) · `packages/desktop/test/e2e/parity-pg1-menu-state.spec.ts` (`PG1:`) | passing `it` + passing `test` | ✅ fixed (engine #4410 · desktop wave 2) |
| **PG2** | major | source-mode → WYSIWYG caret not restored (`handleFileChange` drops `muyaIndexCursor`) | `packages/muya/src/__tests__/setCursorByOffset.spec.ts` (`PG2:` ×5) · `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG2:`) | passing `it` + passing `test` | ✅ fixed (engine `setCursorByOffset` + desktop wave 2) |
| **PG3** | major | `autoCheck` preference not consumed (task-list checkbox cascade lost) | `packages/muya/src/block/gfm/taskListCheckbox/__tests__/parityAutoCheck.spec.ts` (`PG3:` ×2) | passing `it` | ✅ engine fixed (#4409) |
| **PG4** | major | drag-drop image insertion (local file + web link) absent | `packages/muya/src/editor/__tests__/dragDropImage.spec.ts` (PG4 ×7) · `packages/desktop/test/PARITY_QA.md` § PG4 | unit (synthetic `DataTransfer`) + manual-QA | ✅ engine fixed (#4413) |
| **PG5** | major | binary/bitmap clipboard image paste lost (screenshot, browser "Copy Image") | `packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (`PG5:`) · `packages/desktop/test/PARITY_QA.md` § PG5 | passing `it` + manual-QA | ✅ engine fixed #4411 (OS-clipboard manual-QA remains) |
| **PG6** | major | pasted image FILE bypasses `imageAction` (copy-to-assets / upload preference ignored) | `packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (`PG6:` ×2) | passing `it` | ✅ engine fixed (#4411) |
| **PG7** | major | export loads core CSS from CDN instead of inlining it (unstyled offline) | `packages/muya/src/state/__tests__/parityExportHtml.spec.ts` (`PG7:` ×2) | passing `it` | ✅ engine fixed (#4412) |
| **PG8** | major | exported headings carry no `id` (dead TOC / `[TOC]` anchors) | `packages/muya/src/state/__tests__/parityExportHtml.spec.ts` (`PG8:` ×2) | passing `it` | ✅ fixed (engine #4412 · desktop pdf.ts slugger wave 2) |
| **PG9** | major | "Copy as Rich Text" pastes HTML *source* not rich text (no `copyAsRich` path) | `packages/muya/src/clipboard/__tests__/parityCopyAsRich.spec.ts` (`PG9:` ×2) | passing `it` | ✅ fixed (engine #4411 · desktop `copyAsRich` map wave 2) |
| **PG10** | minor | `preview-image` never emitted — select-image + Space full-screen preview lost | `packages/muya/src/selection/__tests__/parityPreviewImage.spec.ts` (`PG10:` ×2) | passing `it` | ✅ engine fixed #4414 (desktop subscription already present) |
| **PG11** | minor | `heading-copy-link` never emitted — hover-to-copy-anchor affordance gone | `packages/muya/src/__tests__/parityHeadingCopyLink.spec.ts` (`PG11:` ×2) | passing `it` | ✅ fixed (engine #4414 · desktop subscription wave 2) |
| **PG12** | minor | `hideLinkPopup` preference not consumed — link hover popover not gated | `packages/muya/src/editor/__tests__/parityHideLinkPopup.spec.ts` (`PG12:`) | passing `it` (+ control) | ✅ engine fixed (#4409) |
| **PG13** | minor | `insertParagraph` anchors to outermost not immediate block in nested structures | `packages/muya/src/__tests__/parityInsertParagraphNested.spec.ts` (`PG13:` ×2) | passing `it` | ✅ engine fixed (#4408) |
| **PG14** | minor | first undo after source-mode doesn't revert the edit as one step | `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG14:`) | `test.fail()` | ❌ xfail (accept-defer) |
| **PG15** | minor | undo back to on-disk content doesn't restore the saved/clean indicator | `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG15:`) | passing `test` | ✅ desktop fixed (wave 2) |

### Severity tally

- **major:** PG1, PG2, PG3, PG4, PG5, PG6, PG7, PG8, PG9 (9) — all fixed
- **minor:** PG10, PG11, PG12, PG13, PG14, PG15 (6) — all fixed except **PG14**

### PG14 — why it is deferred

On source-mode exit, `handleFileChange` rebuilds the document via `setContent`
(which `history.clear()`s) then restores the pre-source op stack, so the bulk
source-mode change is not recorded as a single engine undo op. Making it one
undo boundary would require computing a general whole-document `ot-json1` diff
(pre-source state → post-source state) and applying it through
`Editor.updateContents`' pick/drop walker. That walker only handles a fixed set
of op shapes (block insert at index, text edit, `checked`/`meta`); an arbitrary
diff (removes, moves, nested replaces) could mis-apply and corrupt the document.
The risk outweighs the benefit — first-undo granularity across the boundary is a
narrow edge case, undo still works, and the prior op stack is intact — so PG14
is left as `test.fail()` rather than shipping a fragile fix. Reviving it cleanly
would mean a dedicated engine "record a state replacement as one op" API.

## Running the suites

```bash
# muya engine parity tests (all pass; PG2 cursor mapping is also covered by
# src/__tests__/setCursorByOffset.spec.ts)
pnpm -C packages/muya test

# a single gap's engine tests
pnpm -C packages/muya exec vitest run src/state/__tests__/parityExportHtml.spec.ts

# desktop parity e2e (needs `pnpm run build:unpack` first; PG14 stays xfail)
pnpm -C packages/desktop exec playwright test \
  test/e2e/parity-pg1-menu-state.spec.ts \
  test/e2e/parity-source-undo-saved.spec.ts \
  --config test/e2e/playwright.config.ts
```

## Provenance

Gap analysis: the adversarially-verified `d2-parity-review` of PR #4406
(`PG01..PG16` + `PG-COPYRICH`). After de-duplication there are 15 distinct
gaps (the legacy "Space preview" and "insert-paragraph anchor" gaps each
appeared twice; `copyAsRich` is counted as one of the 15). The `PGn` numbering
on this board is the canonical 1–15 list, not the raw review ids.
