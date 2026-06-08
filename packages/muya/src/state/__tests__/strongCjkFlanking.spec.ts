// @vitest-environment happy-dom

import type { Token } from '../../inlineRenderer/types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../../inlineRenderer/lexer';
import { renderToStaticHTML } from '../renderToStaticHTML';

// Regression coverage ported from marktext#4307 (legacy desktop spec
// `test/unit/specs/markdown-strong-cjk.spec.ts`). Strong emphasis (`**…**`)
// whose `**` delimiters sit directly against a CJK character should still be
// recognised, even when the emphasised content begins/ends with a punctuation
// character (a quote, bracket, or paren).
//
// THE ENGINE GAP, AND HOW IT IS NOW CLOSED:
//   muya tokenises inline markdown through TWO paths, and CommonMark's
//   emphasis "flanking" rule denies bold in both for CJK-bounded runs. The
//   spec classifies every character as whitespace, (Unicode) punctuation, or
//   "other"; CJK ideographs and Hangul are "other". For a left-flanking `**`
//   run, clause (2b) requires the character *before* the run to be whitespace
//   or punctuation whenever the character *after* the run is punctuation. In
//   `例子例子**"加粗"**例子例子` the char after the opening `**` is `"`
//   (punctuation) and the char before it is `子` (a CJK ideograph → "other"),
//   so the run is not left-flanking and the `**` stays literal.
//
//   Legacy marktext (muyajs) shipped a custom inline tokenizer whose
//   `canOpen/canCloseEmphasis` flanking helpers treat CJK as punctuation. We
//   restore that, additively, in both of muya's paths:
//     - Static / export path  — marked@16, via the `cjkEmStrong` tokenizer
//       override registered in `getHighlightHtml` / `getClipboardHtml`.
//     - Live editor path       — muya's own inline lexer, via the CJK widening
//       in `inlineRenderer/utils.ts` (`canOpen/canCloseEmphasis`).
//
//   The widening is additive: it never bolds anything CommonMark accepts as
//   non-emphasis, so the CommonMark / GFM conformance suites are unaffected.
//
//   See marktext/marktext#4307.

const STATIC_OPTIONS = {
    footnote: false,
    math: false,
    superSubScript: false,
    isGitlabCompatibilityEnabled: false,
    frontMatter: false,
    sanitize: false,
} as const;

// The four #4307 examples — CJK ideographs, Kana, Hangul, and a non-BMP CJK
// Ext-B example — that legacy bolded and muya now bolds too.
const CJK_CASES = [
    '例子例子**"加粗"**例子例子', // CJK ideographs, fullwidth quotes
    '日本語**(強調)**日本語', //     Kana/ideographs, fullwidth parens
    '한국어**[강조]**한국어', //      Hangul syllables, brackets
    // Non-BMP CJK (CJK Ext-B): 𠀀 is U+20000, stored as a surrogate pair. The
    // flanking boundary check must read the full code point.
    '𠀀𠀁**"加粗"**𠀀𠀁',
];

// Cases that already work — they lock in the pre-existing behavior so the fix
// can't regress them. Each emphasised run is bounded by a CJK ideograph or
// whitespace on the inner side, satisfying flanking without the CJK widening.
const SANITY_CASES = [
    'before **"normal"** after',
    'before**normal**after',
    '中文**加粗**中文',
];

// Cases that MUST NOT bold — the additive CJK widening must leave these as
// CommonMark rejects them.
const NEGATIVE_CASES = [
    'a * foo bar*', //   space after opening `*` — not left-flanking
    'a_foo bar_', //     intraword `_` emphasis is disallowed
    '*(*foo)', //        inner `(` makes the run both-flanking, can't open
];

function rendersStrong(src: string): boolean {
    return /<strong>/.test(renderToStaticHTML(src, STATIC_OPTIONS));
}

function rendersEm(src: string): boolean {
    return /<em>/.test(renderToStaticHTML(src, STATIC_OPTIONS));
}

function collectTypes(tokens: Token[], out: string[] = []): string[] {
    for (const token of tokens) {
        out.push(token.type);
        if ('children' in token && Array.isArray(token.children))
            collectTypes(token.children, out);
    }
    return out;
}

function tokenizesEmphasis(src: string): boolean {
    const types = collectTypes(tokenizer(src, { hasBeginRules: false }) as Token[]);
    return types.includes('strong') || types.includes('em');
}

describe('strong emphasis with CJK boundaries (#4307)', () => {
    describe('static / export path — renderToStaticHTML (marked@16)', () => {
        for (const src of SANITY_CASES) {
            it(`recognises strong in: ${src}`, () => {
                expect(rendersStrong(src)).toBe(true);
            });
        }

        for (const src of CJK_CASES) {
            it(`recognises strong in CJK context: ${src}`, () => {
                expect(rendersStrong(src)).toBe(true);
            });
        }

        for (const src of NEGATIVE_CASES) {
            it(`does not bold or italicise: ${src}`, () => {
                // Assert NEITHER <strong> NOR <em>: because this PR widens the
                // emphasis/strong flanking logic, a regression could surface as
                // unexpected <em> output while still passing a <strong>-only
                // check. Guard both tags so the negative cases stay meaningful.
                expect(rendersStrong(src), src).toBe(false);
                expect(rendersEm(src), src).toBe(false);
            });
        }
    });

    describe('live editor path — inlineRenderer tokenizer', () => {
        for (const src of SANITY_CASES) {
            it(`tokenizes strong/em in: ${src}`, () => {
                expect(tokenizesEmphasis(src), src).toBe(true);
            });
        }

        for (const src of CJK_CASES) {
            it(`tokenizes strong/em in CJK context: ${src}`, () => {
                expect(tokenizesEmphasis(src), src).toBe(true);
            });
        }

        for (const src of NEGATIVE_CASES) {
            it(`does not tokenize strong/em in: ${src}`, () => {
                expect(tokenizesEmphasis(src), src).toBe(false);
            });
        }
    });
});
