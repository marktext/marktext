// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../renderToStaticHTML';

// Regression coverage ported from marktext#4307 (legacy desktop spec
// `test/unit/specs/markdown-strong-cjk.spec.ts`). Strong emphasis (`**…**`)
// whose `**` delimiters sit directly against a CJK character should still be
// recognised, even when the emphasised content begins/ends with a punctuation
// character (a quote, bracket, or paren).
//
// WHY THE CJK CASES FAIL ON @muyajs/core (documented engine gap):
//   The new engine tokenises inline markdown with marked@16, which implements
//   the CommonMark emphasis "flanking" rule literally. CommonMark classifies
//   every character as whitespace, (Unicode) punctuation, or "other"; CJK
//   ideographs and Hangul are "other". For a left-flanking `**` run, clause
//   (2b) requires the character *before* the run to be whitespace or
//   punctuation whenever the character *after* the run is punctuation. In
//   `例子例子**"加粗"**例子例子` the char after the opening `**` is `"`
//   (punctuation) and the char before it is `子` (a CJK ideograph → "other",
//   neither whitespace nor punctuation), so the run is not left-flanking and
//   marked emits the literal `**`. The same happens at the closing run.
//
//   Legacy marktext shipped its own inline tokenizer (muyajs
//   `lib/parser/render`) whose `canOpen/canCloseEmphasis` flanking helpers
//   treat CJK characters as punctuation, so `**` adjacent to a CJK char with
//   punctuation-bounded inner content opens/closes emphasis. marked has no
//   such patch, and fixing it requires either patching the dependency or
//   shipping a custom inline-emphasis tokenizer extension — out of scope for a
//   tests-only fidelity-verification PR. The CJK cases below assert the
//   CORRECT (legacy) behavior and are wrapped in `it.fails`, so:
//     - the suite stays green while the gap exists, AND
//     - the moment the engine starts recognising these (e.g. a marked upgrade
//       or a flanking patch lands) the `it.fails` flips red, forcing this file
//       to be promoted to a plain `it`. Fidelity can only go up.
//
//   This gap is documented in the PR body for #4307 follow-up.

function rendersStrong(src: string): boolean {
    const html = renderToStaticHTML(src, { sanitize: false });
    return /<strong>/.test(html);
}

describe('strong emphasis with CJK boundaries (#4307)', () => {
    // Cases that already work on @muyajs/core — they lock in the pre-existing
    // behavior so any fix to the CJK gap can't regress them. Each emphasised
    // run here is bounded by a CJK ideograph or whitespace on the inner side,
    // so the flanking rule is satisfied without the legacy CJK-as-punctuation
    // patch.
    const sanityCases = [
        'before **"normal"** after',
        'before**normal**after',
        '中文**加粗**中文',
    ];

    for (const src of sanityCases) {
        it(`recognises strong in: ${src}`, () => {
            expect(rendersStrong(src)).toBe(true);
        });
    }

    // CJK-boundary cases. These are the #4307 regression cases the legacy
    // marktext tokenizer fixed. @muyajs/core (via marked) does NOT recognise
    // them — documented engine gap (see file header). The assertion states the
    // CORRECT expected behavior; `it.fails` keeps the suite green until the gap
    // is closed, at which point it must be converted to a plain `it`.
    const cjkGapCases = [
        '例子例子**"加粗"**例子例子',
        '日本語**(強調)**日本語',
        '한국어**[강조]**한국어',
        // Non-BMP CJK (CJK Ext-B): 𠀀 is U+20000, stored as a surrogate pair.
        // The flanking boundary check must read the full code point.
        '𠀀𠀁**"加粗"**𠀀𠀁',
    ];

    for (const src of cjkGapCases) {
        it.fails(`[GAP #4307] should recognise strong in CJK context: ${src}`, () => {
            expect(rendersStrong(src)).toBe(true);
        });
    }
});
