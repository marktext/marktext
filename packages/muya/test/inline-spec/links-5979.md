# Link parsing regressions (#5979)

The 19 CommonMark examples reported in
[issue #5979](https://github.com/marktext/marktext/issues/5979) were reproduced
individually with the live-lexer semantic harness on `dae64914`, before the
image PR. Each produced a `known-difference` against the pinned official
CommonMark 0.31.2 HTML. This is automated lexer evidence, not a desktop manual run.

The fix builds on [PR #5986](https://github.com/marktext/marktext/pull/5986),
whose whitespace changes already repair 552 and 556. Its image-only description
matcher is replaced by one bracket-stack scanner shared by links, images and
emphasis scanning. Successful links deactivate earlier link openers; image
openers remain eligible. Code spans, HTML tokens and destinations are atomic.
Original source text and token ranges remain available for editing.

Reference collection, matching and rendering use the same whitespace collapse
and full Unicode default case folding. No Unicode normalization or unescaping
is applied to labels. The folding table contains Unicode 17.0 default mappings
that differ from Unicode 14.0 lowercase, allowing supported runtimes to agree;
its source and license accompany the table.

Link/image destinations and titles share multiline whitespace and attribute
decoding. Escapes and entities are decoded in one pass. The dependency used for
named HTML entities was already present for the harness and is now a runtime
dependency. The raw HTML change rejects punctuation attached to a tag name;
remaining raw HTML and general entity-text gaps stay in their separate baseline.

| CommonMark example | Reproduced failure | On image PR #5986 | Combined fix |
| --- | --- | --- | --- |
| [493](https://spec.commonmark.org/0.31.2/#example-493) | Invalid `<foo\>` consumed as HTML | Fails | Passes |
| [494](https://spec.commonmark.org/0.31.2/#example-494) | Invalid `<b)c>` consumed as HTML | Fails | Passes |
| [503](https://spec.commonmark.org/0.31.2/#example-503) | Destination entity remains encoded | Fails | Passes |
| [506](https://spec.commonmark.org/0.31.2/#example-506) | Title entity remains encoded | Fails | Passes |
| [510](https://spec.commonmark.org/0.31.2/#example-510) | Title on the following line is missed | Fails | Passes |
| [513](https://spec.commonmark.org/0.31.2/#example-513) | Unmatched closing bracket absorbed into link text | Fails | Passes |
| [515](https://spec.commonmark.org/0.31.2/#example-515) | Escaped opening bracket prevents a valid link | Fails | Passes |
| [518](https://spec.commonmark.org/0.31.2/#example-518) | Prohibited outer link recognized | Fails | Passes |
| [519](https://spec.commonmark.org/0.31.2/#example-519) | Nested links and emphasis have incorrect boundaries | Fails | Passes |
| [520](https://spec.commonmark.org/0.31.2/#example-520) | Nested links inside image description produce incorrect alt text | Fails | Passes |
| [528](https://spec.commonmark.org/0.31.2/#example-528) | Balanced nested reference text rejected | Fails | Passes |
| [529](https://spec.commonmark.org/0.31.2/#example-529) | Escaped bracket in reference text rejected | Fails | Passes |
| [532](https://spec.commonmark.org/0.31.2/#example-532) | Prohibited outer reference link recognized | Fails | Passes |
| [533](https://spec.commonmark.org/0.31.2/#example-533) | Nested reference links and emphasis produce an outer link | Fails | Passes |
| [540](https://spec.commonmark.org/0.31.2/#example-540) | `ẞ` does not resolve the `SS` definition | Fails | Passes |
| [541](https://spec.commonmark.org/0.31.2/#example-541) | Multiline reference label is not collected/normalized | Fails | Passes |
| [550](https://spec.commonmark.org/0.31.2/#example-550) | Paired backslashes lost during reference lookup | Fails | Passes |
| [552](https://spec.commonmark.org/0.31.2/#example-552) | Whitespace around soft break retained | Passes | Passes |
| [556](https://spec.commonmark.org/0.31.2/#example-556) | Whitespace after shortcut reference retained | Passes | Passes |

`links.spec.ts` asserts conformance for all 90 CommonMark and 87 GFM Links
examples, alongside all 44 Images examples from #5986. The browser regression
suite repeats the 19 reported cases in editing and reading modes, reloads
serialized Markdown, and checks a nested-link edit through undo and redo.
Example 520's extensionless local destination `uri3` uses the existing image
placeholder policy. Its exact source is checked there; an additional variant
with a served image URL checks the rendered alt text `[foo](uri2)`.

Run from the repository root:

```sh
pnpm -C packages/muya test
pnpm -C packages/muya test:inline-spec
pnpm -C packages/muya test:inline-spec:types
pnpm -C packages/muya test:spec
pnpm -C packages/muya/e2e e2e:chromium tests/inline/bracket-extensions-5979.spec.ts tests/inline/links-5979.spec.ts tests/blocks/image-descriptions-5981.spec.ts tests/blocks/reference-link-image.spec.ts tests/inline/link-html-precedence.spec.ts tests/inline/link-punctuation-wrap.spec.ts
```

## Review probes: extensions and nested-image cost

All three review reports were reproduced before the follow-up changes:

| Probe | Before | After |
| --- | --- | --- |
| `[see $[x](y)$](/target)` with dollar math enabled | The formula's apparent link deactivates the enclosing link | One enclosing `/target` link with an atomic formula |
| `[+added+](url)` or `[-removed-][ref]` with inline diff enabled | Diff markers become link text | Diff is consumed first; the following tail is parsed independently |
| 1,000 nested images, approximately 10 KB | About 3,075 ms for live tokenization on macOS | About 14 ms in the focused run, 55 ms during concurrent full-suite/browser checks |

Math and inline diff are extensions, not CommonMark constructs. With these
extensions disabled, CommonMark §6.3 requires the inner `[x](y)` link to win in
the first probe, and `[+added+](url)` is an ordinary link. Both behaviors have
explicit control tests. When enabled, the existing
[Pandoc math](https://pandoc.org/MANUAL.html#math) and
[GitLab inline diff](https://docs.gitlab.com/user/markdown/#inline-diff)
syntax and the application's established precedence apply. Math, diff and other
literal extension bodies are protected by the same query in bracket and
emphasis scanning. Chunk matching is a pure query followed by explicit consumption.

[CommonMark §6.4](https://spec.commonmark.org/0.31.2/#images) permits nested image
descriptions and recommends their plain text as alt text. The performance fix
preserves this syntax without imposing a new nesting limit: child tokenization
reuses the paragraph's bracket index, with block-relative offsets and a bound
that prevents consuming a tail outside the child's source. Each top-level tokenizer call
starts a fresh index for its source and options, avoiding cross-document caches.
The 500 ms unit-test and 2,000 ms browser-test budgets are product regression
guards, not timing requirements imposed by CommonMark.

The review regression suite covers all enabled math delimiter forms, inline and
reference tails, both diff variants, disabled-extension controls, nested source
offsets, and the 1,000-level image case. Chromium also checks rendering, source
round-tripping and the disabled-extension modes after reloading content.

## Supported Node runtime compatibility

The first CI run exposed a module-loading failure on the older Node runtime.
Vite converted Unicode mapping keys into named ESM exports, including
`export const ꟎ = "꟏"`, whose identifier is rejected by older JavaScript parsers.
This was reproduced locally on Node 20.19.5; the same module loaded on the newer
local Node runtime. Keeping the mappings under an ASCII `mappings` property
prevents those named exports without changing any folding values. The full
974-case live-spec suite and both bracket regression files pass on Node 20.19.5,
including a label containing a newly added Unicode letter.
