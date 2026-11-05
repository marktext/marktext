// @vitest-environment happy-dom

import type { Token } from '../../inline/model/types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../../inline/lexer';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

// #4307: CJK-adjacent emphasis must work in both the live editor and Marked
// exports, including when the emphasized content starts or ends in punctuation.

const STATIC_OPTIONS = {
    footnote: false,
    texMathDollars: false,
    superSubScript: false,
    texMathGfm: false,
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

const SANITY_CASES = [
    'before **"normal"** after',
    'before**normal**after',
    '中文**加粗**中文',
];

const MIXED_CASES = [
    ['a**中文**b', 'strong', 'a<strong>中文</strong>b'],
    ['a**中文**', 'strong', 'a<strong>中文</strong>'],
    ['**中文**b', 'strong', '<strong>中文</strong>b'],
    ['a*日本語*b', 'em', 'a<em>日本語</em>b'],
    ['a**한국어**b', 'strong', 'a<strong>한국어</strong>b'],
    ['a**𠀀**b', 'strong', 'a<strong>𠀀</strong>b'],
    ['a~~中文~~b', 'del', 'a<del>中文</del>b'],
    ['中**"加粗**b', 'strong', '中<strong>&quot;加粗</strong>b'],
    ['a**加粗"**文', 'strong', 'a<strong>加粗&quot;</strong>文'],
] as const;

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
    const types = collectTypes(tokenizer(src, { profile: 'inline' }) as Token[]);
    return types.includes('strong') || types.includes('em');
}

describe('strong emphasis with CJK boundaries (#4307)', () => {
    it.each(MIXED_CASES)('keeps live, export and clipboard formatting aligned: %s', (source, type, html) => {
        const tokens = tokenizer(source, { profile: 'inline', options: STATIC_OPTIONS });
        expect(collectTypes(tokens)).toContain(type);
        expect(renderToStaticHTML(source, STATIC_OPTIONS)).toBe(`<p>${html}</p>\n`);
        expect(getClipBoardHtml(source, STATIC_OPTIONS)).toBe(`<p>${html}</p>\n`);
    });

    describe('static / export path — renderToStaticHTML (marked)', () => {
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
                expect(rendersStrong(src), src).toBe(false);
                expect(rendersEm(src), src).toBe(false);
            });
        }
    });

    describe('live editor path — inlineEngine tokenizer', () => {
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
