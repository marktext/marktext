# Design: Fold/Collapse Text (#1869)

> **Status:** Draft — awaiting maintainer input  
> **Issue:** [#1869](https://github.com/marktext/marktext/issues/1869) (28 👍, 45 comments, open since Jan 2020)  
> **Related PR:** [#4331](https://github.com/marktext/marktext/pull/4331) by @Tux69140 (open, merge conflicts, no maintainer review)  
> **Author:** @rkristelijn  
> **Date:** 2026-08-31

## Problem

Users want to fold/collapse sections in the editor body to focus on specific parts of a document. The TOC sidebar offers navigation but doesn't hide content in the editor itself. This is the 4th most upvoted open issue.

Community requests (by frequency):

1. Foldable headings — hide everything under a heading until the next same-or-higher-level heading
2. Foldable code blocks
3. Foldable indented lists

## Current State

- **No fold infrastructure exists** in either editor mode (WYSIWYG or Source Code)
- The WYSIWYG engine (muya) has two versions:
  - **New muya** (`packages/muya`, TypeScript) — block tree with `LinkedList` children, `attachments` pattern for UI elements
  - **Legacy muyajs** (`packages/muyajs`, JS) — flat vnode array, snabbdom rendering
- **CodeMirror 5** (Source Code mode) has fold addons available via npm but none are imported. The `one-dark.css` theme already includes fold gutter CSS rules
- **PR #4331** implements fold for legacy muyajs + source code mode, but targets the legacy engine and has merge conflicts

## Architecture Notes

The new muya engine has a proven pattern for attaching non-content UI to blocks:

- `HeadingCopyLink` — link icon on heading hover (attachment on `AtxHeading`)
- `TaskListCheckbox` — checkbox before list items (attachment on `TaskListItem`)

Both use the `attachments` LinkedList on `Parent` blocks. A fold toggle would follow the same pattern.

Key classes and their roles:

| Class                  | Role                                                     |
| ---------------------- | -------------------------------------------------------- |
| `AtxHeading`           | Heading block, owns `meta.level`, has `attachments` list |
| `HeadingCopyLink`      | Attachment template — renders icon, handles click        |
| `ScrollPage`           | Root block, direct children are top-level blocks         |
| `LinkedList<TreeNode>` | Sibling traversal for finding blocks to fold             |
| `ParagraphFrontButton` | Floating UI positioned via `@floating-ui/dom`            |

## Options

### Option A: WYSIWYG only — heading fold (minimal, highest value)

Add a chevron/toggle next to headings in the WYSIWYG editor. Click folds all content until the next heading of equal or higher level.

**Implementation:**

1. New `HeadingFoldToggle` attachment (follows `HeadingCopyLink` pattern)
2. Runtime `folded` boolean on `AtxHeading` (not serialized to markdown — fold is a UI concern)
3. Hide sibling blocks via CSS class (`mu-folded-content { display: none }`)
4. Walk `heading.next` in the `LinkedList` until reaching a heading with `level <= this.level`
5. Keyboard shortcut: `Cmd/Ctrl+Shift+[` on a heading line (matches VS Code convention)
6. Fold state lives per tab, cleared on close

**Scope:** ~10 files, estimated 2-3 days  
**Covers:** Primary community request (foldable headings)

### Option B: WYSIWYG + Source Code mode

Everything from Option A, plus CodeMirror fold support:

7. Import CodeMirror fold addons (`foldcode`, `foldgutter`, `markdown-fold`)
8. Enable fold gutter in `sourceCode.vue` config
9. CSS is already present in `one-dark.css` — may need additions for other themes

**Additional scope:** ~3 files on top of A, estimated +1 day  
**Covers:** Fold in both editing modes

### Option C: Cherry-pick PR #4331

Rebase @Tux69140's PR #4331, resolve conflicts, and integrate.

**Pros:**

- Work already done, includes e2e tests
- Covers both legacy WYSIWYG and source code mode

**Cons:**

- Targets legacy `muyajs` engine (not the new TypeScript `muya`)
- Merge conflicts need resolution
- Only Copilot review — code quality unknown
- Legacy engine is likely being phased out

**Scope:** ~1 day for rebase + conflict resolution, but carries maintenance risk

### Option D: Full-featured — headings + code blocks + lists

Everything from Option B, plus:

10. Foldable code blocks in WYSIWYG (similar attachment pattern)
11. Foldable indented lists (toggle on parent list item)
12. Preference: "Enable fold controls" (on/off)
13. Menu items + keybindings: Fold All, Unfold All, Fold Level 1/2/3
14. Fold state preserved per tab (not persisted to file)
15. Search integration: auto-unfold when a match is inside a folded section
16. Cursor navigation: arrow keys skip folded content

**Scope:** ~25-30 files, estimated 1-2 weeks  
**Covers:** All community requests

## Edge Cases (apply to all options)

| Case                                                   | Proposed behavior                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Search hits inside folded section                      | Auto-unfold the section, highlight match                                     |
| Cursor enters folded region (arrow keys)               | Skip to next visible block                                                   |
| Copy/paste from folded region                          | Include folded content (fold is visual only)                                 |
| Export to HTML/PDF                                     | Include all content regardless of fold state                                 |
| Undo after fold toggle                                 | Undo restores previous fold state                                            |
| Nested headings (h2 under h1 fold)                     | Folding h1 hides everything including h2; folding h2 only hides h2's content |
| Empty section (heading followed by same-level heading) | Chevron shown but fold is a no-op                                            |

## Recommendation

Start with **Option A** — it addresses the primary request with the smallest footprint and follows established muya architecture patterns. Option B (source code mode) can be added incrementally since CodeMirror fold addons are self-contained. Option D features (code blocks, lists, preferences) can follow as separate PRs.

Option C is not recommended for the fork since it targets the legacy engine.

## Open Questions for Maintainer

1. Should fold state be serialized (e.g., as HTML comments in markdown) or remain purely runtime?
2. Is the new muya engine (`packages/muya`) the correct target, or should legacy muyajs also be supported?
3. Should fold controls be behind a preference toggle, or always enabled?
4. Are there plans to migrate to CodeMirror 6? (Affects whether we invest in CM5 fold addons)
