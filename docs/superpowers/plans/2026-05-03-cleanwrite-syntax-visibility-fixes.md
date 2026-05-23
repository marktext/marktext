# Clean Write Syntax Visibility Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix heading `#` detection (require space) and show inline format markers at line boundaries in clean write mode.

**Architecture:** Two isolated edits in muya parser layer. No new files, no new dependencies.

**Tech Stack:** JavaScript, muya markdown parser

---

### Task 1: Fix heading regex — `#` must be followed by space

**Files:**
- Modify: `src/muya/lib/parser/rules.js:7`

- [ ] **Step 1: Apply regex change**

The current regex `(\s{1,}|$)` allows bare `#` at EOL. Remove `$` alternative:

```js
// Before
header: /(^ {0,3}#{1,6}(\s{1,}|$))/,

// After
header: /(^ {0,3}#{1,6}\s{1,})/,
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/muya/lib/parser/rules.js
git commit -m "fix: require space after # for heading detection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Show inline format markers at line boundaries in clean write mode

**Files:**
- Modify: `src/muya/lib/parser/render/index.js:212-213`

- [ ] **Step 1: Add token type filter for clean write mode**

Replace the unconditional `AG_HIDE` in clean write branch with boundary-aware logic:

```js
// Before (lines 212-214)
if (this.muya.options.cleanWrite) {
  return CLASS_OR_ID.AG_HIDE
}

// After
if (this.muya.options.cleanWrite) {
  if (/^(strong|em|del|inline_code|inline_math|highlight|sup_sub|code_fense)$/.test(token.type)) {
    // Show markers at line boundaries so user can see format edges
    const blockTextLen = (block.text || '').length
    const atStart = token.range && token.range.start === 0
    const atEnd = token.range && token.range.end === blockTextLen
    if (atStart || atEnd) {
      return CLASS_OR_ID.AG_GRAY
    }
  }
  return CLASS_OR_ID.AG_HIDE
}
```

Note: If `block.text` is not the correct way to get total text length during implementation, compute it from `block.children` tokens by summing their range extents.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/muya/lib/parser/render/index.js
git commit -m "feat: show inline format markers at line boundaries in clean write mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Manual verification in `npm run dev`

- [ ] Type `#` alone → `#` visible as plain text (not hidden)
- [ ] Type `#text` (no space) → `#text` visible as plain text
- [ ] Type `# title` → heading created, `# ` hidden
- [ ] Full-line `**text**` → `**` markers dimmed at ends
- [ ] Mid-line `a **bold** word` → `**` markers hidden
- [ ] Non-clean-write mode: `#` behavior unchanged (heading still works with space)
