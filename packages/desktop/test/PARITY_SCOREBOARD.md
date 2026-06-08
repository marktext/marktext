# Parity scoreboard — muyajs → @muyajs/core (PR #4406 follow-ups)

This is a **failing-test scoreboard**. The desktop app migrated from the legacy
`packages/muyajs` engine to `@muyajs/core` (`packages/muya`) in PR #4406. That
migration left **15 confirmed functional-parity gaps**. This board encodes each
one as a regression test that **fails on `develop` today** (proving the gap) but
is marked as an *expected failure* so the test suites stay GREEN.

## How it works

- **muya engine unit tests** (`packages/muya/src/**/__tests__/parity*.spec.ts`)
  use vitest `it.fails(...)`: the assertion describes the correct
  (pre-migration) behaviour and fails today, which vitest counts as a *pass*.
  When a fix lands and the behaviour becomes correct, the test starts passing
  and `it.fails` then **errors** — forcing the fixer to delete `.fails`.
- **desktop e2e tests** (`packages/desktop/test/e2e/parity-*.spec.ts`) use
  Playwright `test.fail()`: the test runs headless and currently fails, which
  Playwright counts as a *pass*. When the fix lands, remove `test.fail()`.
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

> **Gaps remaining: 15 / 15.** All entries are xfail (failing as expected).

| Gap | Severity | Behaviour lost | Test location(s) | Mechanism | Status |
|-----|----------|----------------|------------------|-----------|--------|
| **PG1** | major | `selection-change` lacks block affiliation / ancestor type → native Paragraph & Format menu state is dead | `packages/muya/src/selection/__tests__/paritySelectionChange.spec.ts` (`PG1:` ×2) · `packages/desktop/test/e2e/parity-pg1-menu-state.spec.ts` (`PG1:`) | `it.fails` + `test.fail()` | ❌ xfail |
| **PG2** | major | source-mode → WYSIWYG caret not restored (`handleFileChange` drops `muyaIndexCursor`) | `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG2:`) | `test.fail()` | ❌ xfail |
| **PG3** | major | `autoCheck` preference not consumed (task-list checkbox cascade lost) | `packages/muya/src/block/gfm/taskListCheckbox/__tests__/parityAutoCheck.spec.ts` (`PG3:` ×2) | `it.fails` | ❌ xfail |
| **PG4** | major | drag-drop image insertion (local file + web link) absent | `packages/desktop/test/PARITY_QA.md` § PG4 | manual-QA | ❌ xfail |
| **PG5** | major | binary/bitmap clipboard image paste lost (screenshot, browser "Copy Image") | `packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (`PG5:`) · `packages/desktop/test/PARITY_QA.md` § PG5 | `it.fails` + manual-QA | ❌ xfail |
| **PG6** | major | pasted image FILE bypasses `imageAction` (copy-to-assets / upload preference ignored) | `packages/muya/src/clipboard/__tests__/parityImagePaste.spec.ts` (`PG6:` ×2) | `it.fails` | ❌ xfail |
| **PG7** | major | export loads core CSS from CDN instead of inlining it (unstyled offline) | `packages/muya/src/state/__tests__/parityExportHtml.spec.ts` (`PG7:` ×2) | `it.fails` | ❌ xfail |
| **PG8** | major | exported headings carry no `id` (dead TOC / `[TOC]` anchors) | `packages/muya/src/state/__tests__/parityExportHtml.spec.ts` (`PG8:` ×2) | `it.fails` | ❌ xfail |
| **PG9** | major | "Copy as Rich Text" pastes HTML *source* not rich text (no `copyAsRich` path) | `packages/muya/src/clipboard/__tests__/parityCopyAsRich.spec.ts` (`PG9:` ×2) | `it.fails` | ❌ xfail |
| **PG10** | minor | `preview-image` never emitted — select-image + Space full-screen preview lost | `packages/muya/src/selection/__tests__/parityPreviewImage.spec.ts` (`PG10:` ×2) | `it.fails` | ❌ xfail |
| **PG11** | minor | `heading-copy-link` never emitted — hover-to-copy-anchor affordance gone | `packages/muya/src/__tests__/parityHeadingCopyLink.spec.ts` (`PG11:` ×2) | `it.fails` | ❌ xfail |
| **PG12** | minor | `hideLinkPopup` preference not consumed — link hover popover not gated | `packages/muya/src/editor/__tests__/parityHideLinkPopup.spec.ts` (`PG12:`) | `it.fails` (+ control) | ❌ xfail |
| **PG13** | minor | `insertParagraph` anchors to outermost not immediate block in nested structures | `packages/muya/src/__tests__/parityInsertParagraphNested.spec.ts` (`PG13:` ×2) | `it.fails` | ❌ xfail |
| **PG14** | minor | first undo after source-mode doesn't revert the edit as one step | `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG14:`) | `test.fail()` | ❌ xfail |
| **PG15** | minor | undo back to on-disk content doesn't restore the saved/clean indicator | `packages/desktop/test/e2e/parity-source-undo-saved.spec.ts` (`PG15:`) | `test.fail()` | ❌ xfail |

### Severity tally

- **major:** PG1, PG2, PG3, PG4, PG5, PG6, PG7, PG8, PG9 (9)
- **minor:** PG10, PG11, PG12, PG13, PG14, PG15 (6)

## Running the suites

```bash
# muya engine xfail tests (suite must stay GREEN: it.fails entries count as pass)
pnpm -C packages/muya test

# a single gap's engine tests
pnpm -C packages/muya exec vitest run src/state/__tests__/parityExportHtml.spec.ts

# desktop parity e2e (needs `pnpm run build:unpack` first; suite stays GREEN)
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
