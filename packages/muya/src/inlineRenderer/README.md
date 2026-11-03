# Inline parsing and rendering contracts

`InlineRenderer` is the editor adapter. It selects a block profile, captures the
reference and selection state, decorates tokens with search results, replaces the
block DOM, and owns cleanup. The renderer and parser do not import `Muya`, `Format`
or the editor selection types.

- `model/` owns tokens, source ranges, traversal and range intersection. Token
  `parent` is the owning sibling array, which format commands splice in place.
- `parser/` owns feature defaults, block profiles, scanners, recognition and token
  consumption. Recognition must not advance a frame or append tokens. Scanner
  indexes can be cached. Consumption returns `void`.
- `serialization.ts` rebuilds source; `projection.ts` produces reading text and
  outline HTML. Neither output is the editable DOM or the marked export pipeline.
- `referenceDefinitions.ts` decodes definition captures once and indexes immutable
  document snapshots in document order. The first matching definition wins.
- `renderer/` consumes structural block/cursor data and a render environment.
  Each output captures its environment and owns a postorder child-node cache.
  Shared marker, highlight and link helpers retain syntax-specific DOM layouts.
- `resources/` owns image request states, previews and pending DOM subscriptions.

Offsets are UTF-16 code units with an exclusive end. Public token ranges are
relative to the content block. `SourceWindow.local()` and `.absolute()` convert
scanner-local indexes at frame boundaries. Reading text may differ from source
(e.g. code-span whitespace, image descriptions); never derive editable ranges
from reading text.

Profiles name the current paragraph, ATX heading, Setext heading, table cell and
thematic-break policies. This refactor preserves existing prefix recognition,
including editable heading prefixes. It does not change Markdown dialect rules.
The old `hasBeginRules` option is a fallback when no explicit profile is given.

`parseInline()` does not add search decorations. `tokenizer()` retains the old
parse-plus-decoration API. Existing root module paths and token type names remain
compatibility exports; new implementations belong in their owning subdirectories.

Image resource identity is independent of DOM occurrence identity. Requests for
the same source share a pending Promise; failures can retry. Invalidation rejects
stale completions, while disposal also rejects future requests. Mount callbacks
belong to a block DOM scope: replacing a render, removing a parent subtree,
rebuilding the document or destroying the editor releases those callbacks. Upload
and drag/drop callers use `setImagePreview()` rather than accessing cache maps.
Caches live for the editor lifetime; no size-based eviction policy is introduced.
