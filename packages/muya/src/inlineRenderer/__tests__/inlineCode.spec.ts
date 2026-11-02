// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { generator, tokenizer, tokensToInlineHtml, tokensToPlainText } from '../lexer';

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
        const tokens = tokenizer(source, { hasBeginRules: false });
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
        const tokens = tokenizer(source, { hasBeginRules: false });
        expect(tokensToPlainText(tokens)).toBe(expected);
        expect(generator(tokens)).toBe(source);
    });

    it('protects emphasis delimiters inside code and leaves unmatched runs whole', () => {
        const tokens = tokenizer('**a `` `*` `` b** ```x`` *y*', { hasBeginRules: false });
        expect(tokensToInlineHtml(tokens)).toBe('<strong>a <code>`*`</code> b</strong> ```x`` <em>y</em>');
    });

    it('keeps code inside link text and backticks in destinations independent', () => {
        const tokens = tokenizer('[` a `](/url) [text](/`url`)');
        expect(tokens.map(token => token.type)).toEqual(['link', 'text', 'link']);
        expect(tokensToInlineHtml(tokens)).toBe('<code>a</code> text');
    });
});
