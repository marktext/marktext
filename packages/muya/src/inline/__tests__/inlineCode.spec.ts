// @vitest-environment happy-dom

import { marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';
import { CodeSpanScanner } from '../parser/codeSpan';
import { tokensToInlineHtml, tokensToPlainText } from '../projection';
import { generator } from '../serialization';

describe('live code spans (#5978)', () => {
    it.each([
        [329, '`` foo ` bar ``', '<code>foo ` bar</code>'],
        [330, '` `` `', '<code>``</code>'],
        [331, '`  ``  `', '<code> `` </code>'],
        [335, '``\nfoo\nbar  \nbaz\n``', '<code>foo bar   baz</code>'],
        [336, '``\nfoo \n``', '<code>foo </code>'],
        [337, '`foo   bar \nbaz`', '<code>foo   bar  baz</code>'],
        [340, '` foo `` bar `', '<code>foo `` bar</code>'],
        [342, '[not a `link](/foo`)', '[not a <code>link](/foo</code>)'],
        [347, '```foo``', '```foo``'],
        [349, '`foo``bar``', '`foo<code>bar</code>'],
        [640, '`code  \nspan`', '<code>code   span</code>'],
        [641, '`code\\\nspan`', '<code>code\\ span</code>'],
    ])('commonmark %i', (_number, source, expected) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokensToInlineHtml(tokens)).toBe(expected);
        expect(generator(tokens)).toBe(source);
        for (const token of tokens) {
            expect(source.slice(token.range.start, token.range.end)).toBe(token.raw);
            expect(token.parent).toBe(tokens);
        }
    });

    it.each([
        ['` a`', ' a'],
        ['`a `', 'a '],
        ['`  `', '  '],
        ['`\n\n`', '  '],
        ['` \t `', '\t'],
        ['`\u00A0a\u00A0`', '\u00A0a\u00A0'],
        ['`  a  `', ' a '],
        ['`\r\na\rb\nc\r\n`', 'a b c'],
        ['```` a ``` b ````', 'a ``` b'],
        ['`a\\`tail`', 'a\\tail`'],
    ])('normalizes %j without changing its source', (source, expected) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokensToPlainText(tokens)).toBe(expected);
        expect(generator(tokens)).toBe(source);
    });

    it('protects emphasis delimiters inside code and leaves unmatched runs whole', () => {
        const tokens = tokenizer('**a `` `*` `` b** ```x`` *y*', { profile: 'inline' });
        expect(tokensToInlineHtml(tokens)).toBe('<strong>a <code>`*`</code> b</strong> ```x`` <em>y</em>');
    });

    it('keeps code inside link text and backticks in destinations independent', () => {
        const tokens = tokenizer('[` a `](/url) [text](/`url`)');
        expect(tokens.map(token => token.type)).toEqual(['link', 'text', 'link']);
        expect(tokensToInlineHtml(tokens)).toBe('<code>a</code> text');
    });

    it('keeps many unmatched run lengths literal', () => {
        const source = Array.from({ length: 256 }, (_, i) => `${'`'.repeat(i + 1)}x`).join('');
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokens.map(token => token.type)).toEqual(['text']);
        expect(generator(tokens)).toBe(source);
    });

    it.each([
        ['\\``x`', '<code>x</code>', '`'],
        ['\\```x``', '<code>x</code>', '`'],
        ['\\``x`` y`', '<code>x`` y</code>', '`'],
    ])('allows the unescaped suffix of %j to open code', (source, html, prefix) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokensToInlineHtml(tokens)).toBe(prefix + html);
        expect(generator(tokens)).toBe(source);
    });

    it('agrees with the independent export parser on generated code and escape combinations', () => {
        const alphabet = ['`', '\\', 'a', ' ', '\n', '\t', '\u00A0', '😀'];
        let seed = 5978;
        const next = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let i = 0; i < 5000; i++) {
            let source = '';
            const length = next() % 80;
            for (let j = 0; j < length; j++)
                source += alphabet[(next() >>> 16) % alphabet.length];
            const tokens = tokenizer(source, { profile: 'inline' });
            const expected = marked.Lexer.lexInline(source, { gfm: false })
                .flatMap(token => token.type === 'codespan' && 'text' in token ? [{ raw: token.raw, content: token.text }] : []);
            const actual = tokens.flatMap(token => token.type === 'inline_code' ? [{ raw: token.raw, content: token.content }] : []);
            expect(actual, JSON.stringify(source)).toEqual(expected);
            expect(generator(tokens)).toBe(source);
        }
    });
});

describe('code-span index views', () => {
    it.each([
        ['prefix `x` tail', 7, 10, 3, 1, true],
        ['prefix `x` tail', 7, 9, 1, 1, false],
        ['```x```', 0, 2, 2, 2, false],
        ['\\``x`', 2, 5, 3, 1, true],
        ['`a` `b`', 4, 7, 3, 1, true],
    ] as const)('bounds code spans in %j to [%i, %i)', (source, start, end, matchEnd, markerLength, closed) => {
        const view = new CodeSpanScanner(source).view(start, end);
        expect(view.read(0)).toEqual({ end: matchEnd, markerLength, closed });
        expect(view.read(end - start)).toBeNull();
    });
});
