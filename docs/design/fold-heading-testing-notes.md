# Heading Fold — Testing Notes & Known Pitfalls

> Companion to `fold-collapse-text.md` (design) — captures runtime findings from
> manual testing on branch `feat/heading-fold-muya`.

## ⚠️ Regression: editor hangs when heading box is shrink-wrapped

**Date observed:** 2026-09-08
**Severity:** High — full editor UI freeze (renderer thread), document becomes
uneditable.

### What triggered it

While trying to place the copy-anchor affordance _directly to the right of the
heading text_ (instead of at the far editor edge), the heading box was
shrink-wrapped to its text width so that an `left: 100%` affordance would sit
right after the last character:

```css
/* DO NOT reintroduce — this froze the editor */
.mu-container h1, .mu-container h2, /* ...h3–h6 */ {
  width: fit-content;
  max-width: 100%;
}
```

Applying `width: fit-content` to the contenteditable heading blocks caused the
muya renderer to hang. The heading content is a `display: block`
contenteditable (`.mu-content`, `white-space: pre-wrap`); giving its host
heading an intrinsic (`fit-content`) width appears to trigger a layout / cursor
re-measurement loop on every reflow.

### Key diagnostic signal

- **Main-process log** (`~/Library/Application Support/marktext-dev/logs/<pid>/main.log`)
  showed **nothing** — only normal startup lines. The freeze is in the
  **renderer / UI thread**, not the main process.
- **Renderer console** showed only pre-existing, unrelated warnings
  (`[intlify] Custom Message Compiler experimental`, `[el-dialog] title slot
deprecated`, Electron `webSecurity`/`allowRunningInsecureContent` dev
  warnings). **No** fold/muya/reflow error, **no** JS exception.
- Conclusion: a layout-freeze (not a crash) produces **no console error**.
  Absence of an error does not mean absence of a problem — watch for UI
  unresponsiveness directly.

### Resolution

Reverted `width: fit-content` / `max-width` on headings. Heading blocks are
back to the default full-width `position: relative` box.

## Current affordance placement (safe)

Both heading affordances live in the **left gutter**, clear of the floating
front-button (insert/drag, ~-14px) that appears on every block:

| Affordance       | Selector               | Position      |
| ---------------- | ---------------------- | ------------- |
| Copy-anchor link | `.mu-copy-header-link` | `left: -64px` |
| Fold chevron     | `.mu-fold-toggle`      | `left: -40px` |

Both revealed on heading hover/focus; chevron also stays visible while folded.

## Constraint learned

"Copy-link directly after the last character of the heading text" is **not
cleanly achievable** with the current block structure without altering heading
layout (which caused the hang). Viable safe alternatives:

1. Keep both affordances in the left gutter (current state).
2. Right-align the copy-link to the **text-column edge** via `right: -Npx`
   (Confluence-style), which does **not** touch heading `width` and carries no
   freeze risk.

Avoid: any approach that sets an intrinsic width (`fit-content`, `max-content`,
`inline-block` shrink) on the heading or its contenteditable content span.

## Re-test checklist (after any affordance/layout change)

- [ ] Editor does not freeze on load or on typing in a heading.
- [ ] Long heading that wraps to multiple lines still edits normally; cursor
      lands correctly on click.
- [ ] Hover over a heading reveals link + chevron without overlapping the
      left drag/insert front-button.
- [ ] Chevron folds/unfolds the section; folded state keeps the chevron visible.
- [ ] `Cmd/Ctrl+Shift+[` on a heading line toggles fold.
- [ ] Check across themes (Cadmium Light, Material Dark) — affordance offsets
      are readable and not clipped at narrow window widths.
- [ ] Reload / restart dev server so muya CSS + block changes are picked up
      before judging behavior. (Note: the hang was reverted in source but had
      not yet been verified via reload at time of writing.)
