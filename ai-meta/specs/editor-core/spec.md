# Specification: ContentState — `replaceWordInline` Cursor Desync Fix

> PRIMARY EXAMPLE SPEC — demonstrates the full SDD format for the editor-core feature.

---

## Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-0001 |
| **Feature ID** | F01 |
| **Feature Name** | WYSIWYG Editor Core (Muya ContentState) |
| **Status** | EXAMPLE |
| **Author** | ai-meta generator |
| **Created** | 2026-05-27 |
| **Last Updated** | 2026-05-27 |
| **PR / Branch** | N/A (example) |

---

## 1. Problem Statement

When `replaceWordInline` is called with `setCursor = true` and the replacement text is longer
than the remaining line length, the cursor offset lands beyond the end of the line's new text.
This causes the next `partialRender()` call to attempt to read a character position that does not
exist, resulting in a silent block tree desync where the visual state diverges from `this.cursor`.

Observable symptom: after a spell-check auto-correction replaces a word near end-of-line, the
subsequent keypress may move the cursor to the wrong block or produce no visible output.

**Evidence**: `src/muya/lib/contentState/core.js`, lines ~40–60 (replaceWordInline validation block).

---

## 2. Proposed Solution

Add a post-replacement cursor clamp in `replaceWordInline`:

After computing the new cursor offset (`left + replacement.length`), clamp the value to
`block.text.length` to ensure the cursor never points past the end of the modified text.

This follows the existing defensive pattern already present in `backspaceCtrl.js` where cursor
offsets are clamped after block merges.

---

## 3. Scope — Files to Modify

| File (from repo root) | Change Type | Description |
|-----------------------|-------------|-------------|
| `src/muya/lib/contentState/core.js` | MODIFY | Add cursor offset clamp after `block.text` mutation |

**Files that will NOT be modified**:
- `src/muya/lib/contentState/index.js` — mixin assembly; no change needed
- `src/muya/lib/contentState/updateCtrl.js` — update dispatch; no change needed
- `src/muya/lib/renderers/` — rendering layer; no change needed
- `src/renderer/src/store/editor.ts` — not involved in this code path
- Any IPC-related files — no cross-process change

---

## 4. Behavioral Contract

```
GIVEN  a line block with text "speling is wrong"
AND    a wordCursor pointing to range [0, 7] ("speling")
WHEN   replaceWordInline(line, wordCursor, "spelling", setCursor=true) is called
THEN   block.text becomes "spelling is wrong"
AND    cursor.start.offset = 8  (length of "spelling")
AND    cursor.end.offset = 8
AND    8 <= block.text.length  (clamp invariant satisfied)
AND    partialRender() runs without IndexOutOfBounds error

GIVEN  a line block with text "abc"
AND    a wordCursor pointing to range [1, 3] ("bc")
WHEN   replaceWordInline(line, wordCursor, "bccde", setCursor=true) is called
THEN   block.text becomes "abccde"
AND    cursor offset = 6  (1 + 5 = 6, equals block.text.length — clamped correctly)
AND    cursor.start.offset <= block.text.length  (clamp invariant satisfied)

GIVEN  replaceWordInline is called with setCursor=false
WHEN   any replacement is applied
THEN   this.cursor is NOT modified
AND    the existing cursor state is preserved unchanged
```

---

## 5. Process Boundary Analysis

| Boundary Crossed | Yes/No | Justification |
|------------------|--------|---------------|
| renderer ↔ main (IPC) | NO | Pure muya internal change |
| renderer ↔ muya | NO | No Muya public API change |
| main ↔ filesystem | NO | No file I/O |
| preload surface change | NO | No contextBridge change |

No new IPC channels required.

---

## 6. Regression Surface

| Test File | Coverage Area | Will it still pass? |
|-----------|--------------|---------------------|
| `test/unit/specs/markdown-basic.spec.js` | Basic markdown rendering | YES |
| `test/unit/specs/` (muya unit tests) | ContentState inline ops | YES (clamp only adds safety) |

**New tests required**:
- [ ] `test/unit/specs/contentState-core.spec.js` (new file) — must test:
  - `replaceWordInline` with replacement longer than remaining line: cursor clamped to `block.text.length`
  - `replaceWordInline` with `setCursor=false`: cursor unchanged
  - `replaceWordInline` with exact-length replacement: cursor at `left + replacement.length`

---

## 7. Rollback Strategy

```
git revert <commit-hash>
# No data migration required — pure logic change in a single .js file
# No schema changes
# No IPC changes
```

---

## 8. Assumptions and Open Questions

| # | Assumption / Question | Status |
|---|----------------------|--------|
| 1 | `block.text.length` after mutation equals `left + replacement.length - (right - left)` | VERIFIED via code reading of core.js |
| 2 | `partialRender()` is always called by the caller after `replaceWordInline` | ASSUMED — no runtime enforcement exists |
| 3 | The clamp fix does not affect spell-check callers (spellcheckerCtrl) | OPEN — verify by grepping for `replaceWordInline` callers |

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Clamp changes cursor position for callers that expected the old (wrong) behavior | LOW | MEDIUM | Grep all callers; audit each for cursor expectations |
| Off-by-one in clamp formula | LOW | MEDIUM | New unit test exercises boundary exactly |
| Other ContentState methods share the same cursor desync pattern | MEDIUM | MEDIUM | Out of scope for this spec; log as tech debt |

---

## 10. Implementation Notes

- `replaceWordInline` is called by: `searchCtrl.js` (find-replace), `spellchecker` integration,
  and possibly `formatCtrl.js`. Verify all callers after fix to confirm no behavioral regression.
- The clamping line should be inserted immediately after:
  ```js
  block.text = block.text.substr(0, left) + replacement + block.text.substr(right)
  ```
  and before the `if (setCursor)` block, so the clamped length is available when computing
  the cursor position.
- Do not change the existing validation throw-lines (lines ~20–40 of core.js) — those guards
  are correct and must remain.
