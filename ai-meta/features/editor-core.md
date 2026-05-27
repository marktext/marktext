# Feature: WYSIWYG Editor Core (Muya ContentState)

> Feature ID: F01 | Safety Level: **HIGH RISK** | Process: muya

---

## Scope

The Muya ContentState subsystem is the central document block-tree manager for the WYSIWYG
editing mode. It is the highest-risk module in the repository.

**Primary directory**: `src/muya/lib/contentState/`
**Entry point**: `src/muya/lib/contentState/index.js`
**Public interface**: `src/muya/lib/index.js` (`Muya` class)

---

## Architecture

ContentState uses a **mixin composition** pattern. The `ContentState` class is defined in
`index.js` and then extended at module load time by 25 separate controller files:

```
contentState/index.js           ← Base ContentState class constructor
  └─ Mixed in at load time:
      arrowCtrl.js              ← Cursor arrow navigation
      backspaceCtrl.js          ← Backspace / block merge
      clickCtrl.js              ← Mouse click → cursor
      codeBlockCtrl.js          ← Fenced code blocks
      containerCtrl.js          ← GFM alert containers
      copyCutCtrl.js            ← Copy/cut operations
      core.js                   ← replaceWordInline, partialRender
      deleteCtrl.js             ← Delete key
      dragDropCtrl.js           ← Block drag-and-drop
      emojiCtrl.js              ← Emoji insertion
      enterCtrl.js              ← Enter / paragraph split
      footnoteCtrl.js           ← Footnote handling
      formatCtrl.js             ← Inline formatting (bold, italic, etc.)
      history.js                ← Undo/redo stack
      htmlBlock.js              ← Raw HTML blocks
      imageCtrl.js              ← Image insertion
      inputCtrl.js              ← General keystroke input
      linkCtrl.js               ← Link insertion/editing
      marktext.js               ← MarkText-specific block types
      paragraphCtrl.js          ← Paragraph management
      pasteCtrl.js              ← Paste normalization
      searchCtrl.js             ← In-document search
      tabCtrl.js                ← Tab / indentation
      tableBlockCtrl.js         ← Table creation/editing
      tableDragBarCtrl.js       ← Column drag resize
      tableSelectCellsCtrl.js   ← Cell multi-selection
      tocCtrl.js                ← TOC generation
      updateCtrl.js             ← State update / re-render
```

**Mixin loading order matters.** `index.js` must import all controllers after the base class
is defined. Changing import order can break prototype method resolution.

---

## Data Structures

### Block

The core unit of the document tree. Each block has:
```js
{
  key: string,        // unique ID
  type: string,       // 'p', 'h1'-'h6', 'code_block', 'table', etc.
  text: string,       // raw markdown content for leaf nodes
  parent: Block|null,
  children: Block[],
  // ... additional type-specific fields
}
```

### Cursor

```js
{
  start: { key: string, offset: number, block: Block },
  end:   { key: string, offset: number, block: Block },
  isEdit: boolean
}
```

---

## Key Methods (from code evidence)

| Method | File | Description |
|--------|------|-------------|
| `replaceWordInline(line, wordCursor, replacement, setCursor)` | `core.js` | Atomic inline text replacement with optional cursor update |
| `partialRender()` | `core.js` | Re-render only the changed block subtree |
| `setMarkdown(markdown, cursor, isEditMode)` | `index.js` | Replace entire document content |
| `getMarkdown()` | `index.js` | Serialize document tree to markdown string |
| `undo()` / `redo()` | `history.js` | Undo/redo via operation stack |

---

## Risks

| Risk | Severity | Details |
|------|----------|---------|
| Mixin prototype collision | CRITICAL | Two controllers defining the same prototype method silently overwrite each other; last write wins |
| Block tree corruption | CRITICAL | Inconsistent cursor after a partial render can corrupt the block tree; no runtime integrity check |
| Cascade rendering | HIGH | `partialRender()` → `StateRender.renderBlock()` → DOM mutation; incorrect subtree selection causes visual artifacts |
| History stack overflow | MEDIUM | No confirmed max history size; long editing sessions may accumulate unbounded stack |
| Muya↔Renderer desync | HIGH | `eventCenter.dispatch('stateChange')` must fire exactly once per logical edit; double-fire causes double-IPC |
| PlantUML zlib import | LOW | `parser/render/plantuml.js` imports Node's `zlib` — works in Electron but breaks in pure browser context |

---

## Change Rules

1. New content controllers MUST follow the existing mixin pattern:
   ```js
   const newCtrl = (ContentState) => {
     ContentState.prototype.myNewMethod = function(...) { ... }
   }
   export default newCtrl
   ```
2. New controllers MUST be imported and applied in `contentState/index.js`.
3. Do not refactor the mixin system to ES class inheritance without a full architectural spec.
4. `partialRender()` must be called exactly once at the end of each logical edit operation.
5. Cursor state (`this.cursor`) must be valid at the time `partialRender()` is called.

---

## Spec Reference

→ `ai-meta/specs/editor-core/spec.md`

---

## Test Coverage

- `test/unit/specs/markdown-basic.spec.js` — basic markdown rendering
- `test/unit/specs/` — additional unit tests for specific block types
- **Gap**: No unit tests for ContentState mixin methods directly (only integration-level)
- **Gap**: No undo/redo regression tests confirmed

---

## Related Features

- F02: Markdown Parser (ContentState calls parser on each block)
- F13: Source Code Mode (bypasses ContentState entirely; uses CodeMirror)
- F19: Table Editing (tableBlockCtrl, tableDragBarCtrl, tableSelectCellsCtrl)
