# Clean Write Mode: Syntax Visibility Fixes

**Goal:** Fix broken heading detection (`#` without space) and show inline format markers at line boundaries in clean write mode.

**Scope:** Two targeted fixes in muya parser layer. No new files. All modes get corrected heading behavior; inline marker boundary visibility is clean-write-only.

---

## Fix 1: Heading `#` requires space

**Problem:** `/^ {0,3}#{1,6}(\s{1,}|$)/` matches bare `#` at EOL via `$`, treating it as valid heading. In clean write mode the `#` is hidden, but the user considers `#` alone (or `#text` without space) broken syntax.

**Change:** `src/muya/lib/parser/rules.js:7`

```
header: /(^ {0,3}#{1,6}(\s{1,}|$))/  →  /(^ {0,3}#{1,6}\s{1,})/
```

Remove `$` alternative. `#` followed by 1+ spaces required. `#text` (no space) naturally fails match — rendered as plain text.

**Affects:** All modes. Behavior is more correct: empty heading marker has no content.

---

## Fix 2: Inline format markers visible at line boundaries

**Problem:** `getClassName` unconditionally returns `AG_HIDE` in clean write mode. Inline format markers (`**`, `*`, `` ` ``, `~~`, `==`, `$`) wrapping entire content are invisible — user can't see format boundaries.

**Change:** `src/muya/lib/parser/render/index.js:212` — in `getClassName` cleanWrite branch

When clean write is active, inline format tokens whose range touches the line start or end get `AG_GRAY` (dimmed visible) instead of `AG_HIDE` (hidden). Mid-line markers stay hidden.

Token types to match: `strong`, `em`, `del`, `inline_code`, `inline_math`, `highlight`, `sup_sub`

Boundary test:
- `atLineStart`: token.range.start === 0
- `atLineEnd`: token.range.end === text content length

**Affects:** Clean write mode only.

---

## Verification

1. `npm run build` passes
2. In clean write mode: type `#` → `#` visible (plain text); type `# ` → heading created, `# ` hidden
3. In clean write mode: `**text**` spanning full line shows `**` markers dimmed at ends; `a **bold** word` hides `**` in middle
4. Non-clean-write modes unaffected
