# Selection

The public API on `Muya` handles text, an inline image, a rectangle of table
cells, or `null`. Consumers narrow by `kind: SelectionType`.

```ts
muya.getSelection();      // TSelection | null: current runtime view
muya.getSelectionState(); // TSelectionState | null: copied, serializable fields
muya.setSelection(state); // boolean: false leaves the selection unchanged
muya.getSelectedText();   // string: selected source text
```

`setSelection(null)` clears the selection. Invalid paths, offsets, image ranges
and table coordinates are rejected before replacing the current selection.
Offsets are UTF-16 code units and cannot split a surrogate pair. Image ranges
are `[start, end)` in their containing content string. Table coordinates are
zero-based and include the header row.

## State and context

| Kind | Serializable fields | Runtime `context` |
| --- | --- | --- |
| `text` | `anchor`, `focus`, each `{ path, offset }` | Endpoint blocks, direction, collapsed/same-block flags, formats |
| `image` | `path`, `range`, `raw` | Containing block, current `imageInfo`, current image container `domNode` |
| `table` | `tablePath`, `anchor`, `focus`, each `{ row, column }` | Table, endpoint cells, normalized rectangle |

Every context also has `affiliation`, `selectionCoords`, and `cursorCoords`.
`cursorCoords` is null for object selections. Read-only status remains on
`muya.isReadOnly`.

Runtime views contain live blocks and DOM nodes; do not persist them. Use
`getSelectionState()` for history, tab cursors, and serialized data. State paths
are copied before querying the block tree because `queryBlock()` consumes its
path argument. Language inputs use the document path `[..., 'meta', 'lang']`;
code content uses `[..., 'text']`. Their runtime block paths alone cannot
distinguish these leaves.

An image is located by content path, absolute source range, and exact raw
source. Its DOM ID is only a runtime rendering detail. This preserves targeting
when multiple images share a URL or identical Markdown. The shared image
interaction supports Markdown images and HTML `img` tags; the separate
reference-image renderer keeps its existing behavior.

## Notifications

```ts
muya.on('selection-change', ({ selection, docChanged }) => {
    const selectedText = muya.getSelectedText();
    if (selection?.kind === SelectionType.TEXT) {
        const formats = selection.context.formats;
    }
});
```

`Selection.flush()` is the only publisher. Native selection and rectangle drag
changes coalesce to one notification per animation frame, with a final flush
on mouseup. Commands notify synchronously after their outer transaction.
Document commits notify even when endpoints stay unchanged. Composition and
document projection suppress intermediate notifications.

Explicit image reselection also notifies when its snapshot is unchanged, so
tools dismissed by scrolling can reopen. Read-only Select All releases table
ownership before synchronizing the whole-document text range. Clearing an
instance removes a native range only when both endpoints are inside its root.

An active rectangle owns the visible selection while the editor root has
focus. Native caret events must not cancel the rectangle or its drag candidate.
An image similarly remains selected while its tools receive focus; a new
pointer interaction in text or an arrow-key command switches back to text.
Selections owned by another editor or an external tool do not overwrite this
editor's logical state.

Scroll, resize, and image loading use existing float positioning. They do not
emit selection changes. Toolbars observe the unified event; explicit edit,
preview, and picker actions retain their action events.

## Text extraction and history

Text selections retain source-text and container separator semantics. Table
rectangles concatenate cell source in row order, with tabs between columns
and newlines between rows, including empty cells and the header. Object-selected
images return an empty string. The desktop uses this result for selected word
counts.

History stores the same pure state union. A mutation captures the pre-edit
selection; undo applies its operation before restoring that target. The reverse
stack captures the selection immediately before replay, including later caret
movement. Replay does not create another history entry.

This is a breaking API change: old flat event fields, caret-type enum,
`setCursor()` input variants, and old serialized history selection shapes have
been removed. `Content.setCursor()` and source-mode `setCursorByOffset()` remain
local editing/coordinate helpers.
