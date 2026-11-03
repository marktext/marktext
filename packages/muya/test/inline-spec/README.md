# Live inline lexer / specification differences

This suite calls `src/inline/lexer.ts` directly. It is independent of
`test/spec/`, which measures the marked-based HTML export path. A green run means
the live lexer's differences match the reviewed baseline, not 100% conformance.

Run from the repository root:

```sh
pnpm -C packages/muya test:inline-spec
pnpm -C packages/muya test:inline-spec:types
```

Each run prints section totals and writes
`packages/muya/test-results/inline-spec/report.json` (git-ignored). The report
contains the spec version, example ID, original Markdown, adapted inline source,
expected/actual semantic events, classification, and source invariant failures.
The Muya Spec CI job runs this suite and uploads that report, including on failure.

## Scope and input adaptation

CommonMark examples come from the pinned `commonmark-spec@0.31.2` dependency. GFM
examples reuse the repository's `gfm-spec-0.29-gfm.json`. All inline sections plus
backslash escapes and entities are selected: 356 CommonMark and 366 GFM examples.
Tables, task lists and other block sections are outside this suite's denominator.
The fixtures' visible tab notation (`→`) is converted to U+0009 in source and
expected HTML, matching the official `spec.json` representation.
The pinned GFM snapshot includes FTP in example 628; the
[current published URL grammar](https://github.github.com/gfm/#autolinks-extension-)
omits it. FTP recognition is retained for snapshot compatibility, rather than
claimed as a requirement of the current published grammar.

`marked.Lexer.blockTokens` provides paragraph/heading boundaries and raw reference
definitions. Its inline tokens, parsed links and rendered HTML are never used to
decide what the live lexer should produce. The live editor's `getLabelInfo`
collects definitions, with first-definition precedence; label normalization and
destination/title handling therefore remain under test. Paragraphs, headings,
multiple paragraphs and reference context are supported. Code blocks, HTML
blocks, lists and other unimplemented block shapes are explicitly `uncovered`.
Disagreements between the adapter's block envelopes and the official HTML are
also uncovered instead of being attributed to the inline lexer.

The adapter applies the production Tab-separator compatibility extension for
reference definitions. Issue #5968 also has explicit link/image regressions in
`links.spec.ts`: the official corpus has no definition with a Tab between its
destination and title. These extra cases are outside the official totals.

The profile disables optional math, footnotes, superscript/subscript, highlighting
and inline-diff syntax. The current lexer cannot disable bare autolinks,
strikethrough or emoji. The suite exercises that real behavior rather than
patching the lexer rules for tests. A difference is an `extension-difference`
only when projecting those extension tokens literally removes the entire
difference. Other defects in the same example remain `known-difference`.

GFM 0.29 fixtures predate some CommonMark 0.31 changes. A `version-difference`
requires the exact same Markdown to exist in the CommonMark corpus and the live
result to match its newer expectation. Such cases are not counted as conforming
to the older GFM fixture.

## Comparison contract

Actual tokens are projected into HTML using their own text, destinations, titles,
alt text and reference labels. No code whitespace, escapes, entities or labels
are repaired by the projection. Unsupported token kinds fail the suite instead
of silently falling back to raw text. This is a lexer semantic projection, not a
test of DOM rendering, sanitization, CSS, selection, or clipboard behavior.

Raw HTML retains its source serialization for syntax comparison, but that alone
cannot validate the lexer's parsed `tag` and `attrs`. A separate recursive check
compares those fields against an independent parse5 tokenization of the raw
token, without DOM tree repairs. Tag names are case-insensitive, and retained
attributes use HTML-decoded values. Missing, unexpected or changed retained
attributes (including `href` and `src`) are differences even when the raw HTML
projection still matches the official example. These differences are reported in
`htmlFields`, participate in classification and enter the baseline fingerprint.

The editor deliberately drops attributes outside `WHITELIST_ATTRIBUTES`,
normalizes `width`/`height`, and supplies empty `title`/`src`/`alt` defaults for
images. Those policies are explicitly recorded in `htmlAttributePolicies`
(`attribute-whitelist`, `dimension-normalization`, `image-default`) rather than
being mistaken for parsing errors. Dimension normalization itself is outside this
comparison. A filtered attribute never exempts a retained attribute on the same
token from checking. The report's `rawHtml` summary distinguishes examples with
field differences from examples containing these policies.

Both the projection and official expected HTML pass through parse5's **tokenizer**,
not its DOM tree builder. The resulting ordered open/close/text/break/comment
events retain nesting and unmatched tags without browser repair. Attribute order,
void-element spelling and equivalent URL percent-encoding are normalized.
Encoded reserved URL delimiters remain distinct. Text whitespace, code spaces and
blank lines, and spaces between inline elements are preserved. A single newline
immediately after `<br>` is treated as HTML serialization formatting; further
newlines and indentation remain significant. Top-level whitespace between block
envelopes is ignored.

Separately, every adapted example checks exact source reconstruction, token/raw
range equality, non-overlapping sibling ranges, parent ownership and child-range
containment. These checks are never allowed to fail through the baseline.

## Maintaining the baseline

`baseline.json` records only nonconforming or uncovered examples, with a reason.
Covered differences also have a fingerprint of the actual and expected semantics,
adapted source and any raw HTML parsed-field differences. New differences,
changed differences, newly conforming cases, and newly covered cases fail the
test so they cannot silently change the report.
Passing cases have no baseline entry. Reason text may be refined without changing
the comparison contract.

After investigating a change, either edit the relevant entries or explicitly
regenerate them on macOS/Linux:

```sh
UPDATE_INLINE_SPEC_BASELINE=1 pnpm -C packages/muya test:inline-spec
```

PowerShell:

```powershell
$env:UPDATE_INLINE_SPEC_BASELINE = '1'
pnpm -C packages/muya test:inline-spec
Remove-Item Env:UPDATE_INLINE_SPEC_BASELINE
```

Review the JSON changes against the full diagnostic report, then run the normal
command again. Generation does not make an unexplained difference acceptable.
Keep coverage limitations explicit when expanding the adapter. Browser interaction
tests are still required when changing marker visibility, caret behavior or DOM
rendering; this suite cannot replace them.
