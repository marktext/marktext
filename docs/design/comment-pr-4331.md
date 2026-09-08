Hi @Tux69140, @Jocs 👋

I've been looking into #1869 as well and wanted to share some findings before potentially duplicating work.

## Analysis of the current situation

@Tux69140 — nice work getting both WYSIWYG and source-code mode fold working. I noticed this PR currently has merge conflicts with `develop` and targets the legacy `muyajs` engine. Since the codebase has been migrating toward the new TypeScript `muya` engine (`packages/muya`), I wanted to map out the options before jumping in.

I did a deep dive into the codebase and found:

- **No fold infrastructure exists** in either engine or the desktop layer
- The new muya engine has a clean pattern for this: `HeadingCopyLink` (attachment on `AtxHeading`) is an exact template for a fold toggle — it uses the `attachments` LinkedList, handles click events, and renders an icon next to headings
- CodeMirror 5 fold addons (`foldcode`, `foldgutter`, `markdown-fold`) are available via npm but not imported. The `one-dark.css` theme already has CSS rules for fold gutters, so wiring is minimal
- The community primarily wants **foldable headings** (original request + most comments), with code blocks and lists as secondary requests

## Proposed approach

I'd recommend an incremental path:

**Phase 1 — WYSIWYG heading fold (new muya engine)**

- New `HeadingFoldToggle` attachment following the `HeadingCopyLink` pattern
- Runtime `folded` boolean on `AtxHeading` (not serialized — fold is a UI concern)
- Hide sibling blocks via CSS until the next same-or-higher-level heading
- Keyboard shortcut (`Cmd/Ctrl+Shift+[`, matching VS Code)
- This addresses the core request with the smallest footprint

**Phase 2 — Source Code mode**

- Import CM5 fold addons, enable fold gutter (CSS already exists)
- Straightforward wiring, can be a separate PR

**Phase 3 — Extended fold targets** (future, separate PRs)

- Code blocks, indented lists
- Preference toggle, Fold All / Unfold All menu items
- Search integration (auto-unfold on match)

I wrote up a more detailed design doc here: [`docs/design/fold-collapse-text.md`](https://github.com/rkristelijn/marktext-fork/blob/feat/fold-collapse-text/docs/design/fold-collapse-text.md)

## Open questions

Before I start on this, a few questions for @Jocs:

1. **Target engine:** Should this target the new `muya` engine only, or should legacy `muyajs` also be supported? (This affects whether @Tux69140's existing work can be integrated directly)
2. **Fold state persistence:** Runtime only, or serialized somehow (e.g. HTML comments)?
3. **Preference toggle:** Always enabled, or behind a setting?
4. **CodeMirror migration:** Any plans to move to CM6? (Affects investment in CM5 fold addons)

## How I see this fitting together

@Tux69140 — if the maintainers prefer targeting the new muya engine, your source-code mode work (the CodeMirror fold gutter part) could still be valuable as a standalone PR since that's engine-independent. If legacy muyajs support is wanted, your WYSIWYG implementation is directly applicable.

I'm happy to take on the new-muya implementation if that's the preferred direction, coordinate with @Tux69140 on the CM5 part, or step back if you'd rather own this end-to-end. Whatever works best for the project.

I also have a few other PRs open (#4345, #4999, #5134, #5136, #5137, #5139) — would appreciate a review on those when you get a chance, @Jocs. Happy to address any feedback.
