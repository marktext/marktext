// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { decodeMarkdownString } from '../../utils/markdownEscape';
import { tokenizer } from '../lexer';
import { parseSrcAndTitle } from '../parser/linkDestination';
import { tokensToPlainText } from '../projection';
import { generator } from '../serialization';

const options = { profile: 'inline' } as const;

describe('commonMark escapes and character references (#5977, #5982)', () => {
    const punctuation = Array.from({ length: 94 }, (_, index) => String.fromCharCode(index + 33))
        .filter(character => !/[A-Z\d]/i.test(character));

    it.each(punctuation)('escapes ASCII punctuation %j without losing source', (character) => {
        const source = `\\${character}`;
        const tokens = tokenizer(source, options);
        expect(tokensToPlainText(tokens)).toBe(character);
        expect(generator(tokens)).toBe(source);
    });

    it.each(['A', '3', 'φ', '«', ' ', '\t'])('preserves a backslash before %j', (character) => {
        const source = `\\${character}x`;
        const tokens = tokenizer(source, options);
        expect(tokensToPlainText(tokens)).toBe(source);
        expect(generator(tokens)).toBe(source);
    });

    it.each([
        ['&Dcaron;&HilbertSpace;&DifferentialD;&ClockwiseContourIntegral;&ngE;', 'Ďℋⅆ∲≧̸'],
        ['&#35;&#1234;&#992;&#0;', '#ӒϠ�'],
        ['&#X22;&#XD06;&#xcab;', '"ആಫ'],
        ['&#x1F600;&#1114111;', '😀\u{10FFFF}'],
        ['&#xD800;&#55296;&#x110000;&#9999999;', '����'],
        ['&nbsp;&ensp;&emsp;', '\u00A0\u2002\u2003'],
        ['&#128;', '\u0080'],
        ['&#9;foo&#10;bar', '\tfoo\nbar'],
        ['&nbsp &x; &#; &#x; &#87654321; &#x0000000; &madeup; &aMp;', '&nbsp &x; &#; &#x; &#87654321; &#x0000000; &madeup; &aMp;'],
        ['\\&ouml; &amp;ouml; &#92;* \\\\&ouml;', '&ouml; &ouml; \\* \\ö'],
        ['&#42;foo&#42;', '*foo*'],
    ])('decodes %j once and preserves Markdown', (source, content) => {
        const tokens = tokenizer(source, options);
        expect(tokensToPlainText(tokens)).toBe(content);
        expect(generator(tokens)).toBe(source);
        expect(decodeMarkdownString(source)).toBe(content);
    });

    it('keeps entities and escapes literal inside code spans', () => {
        const source = '`\\&ouml; &#35; \\*`';
        expect(tokensToPlainText(tokenizer(source, options))).toBe('\\&ouml; &#35; \\*');
    });

    it.each(['[x]', '![x]'])('decodes the destination and title of %s', (label) => {
        const source = `${label}(/f&ouml;&ouml; "ti\\*tle &ngE;")`;
        expect(tokenizer(source, options)[0]).toMatchObject({ title: 'ti*tle ≧̸' });
        expect(parseSrcAndTitle('/f&ouml;&ouml; "ti\\*tle &ngE;"')).toMatchObject({ src: '/föö', title: 'ti*tle ≧̸' });
        expect(generator(tokenizer(source, options))).toBe(source);
    });

    it('does not decode escaped entity openers or reparse decoded backslashes in destinations', () => {
        expect(parseSrcAndTitle('/\\&ouml;/&#92;* "\\&ouml; &amp;ouml;"'))
            .toMatchObject({ src: '/&ouml;/\\*', title: '&ouml; &ouml;' });
    });
});

describe('shared bracket parsing with decoded entities', () => {
    it('keeps HTML attribute brackets atomic inside a decoded link', () => {
        const source = '[<span title="] &Dcaron;">x</span>](/f&ouml;&ouml; "ti\\*tle")';
        const tokens = tokenizer(source, options);
        expect(tokens[0]).toMatchObject({
            type: 'link',
            href: '/föö',
            title: 'ti*tle',
            children: [{ type: 'html_tag', attrs: { title: '] Ď' }, content: 'x' }],
        });
        expect(generator(tokens)).toBe(source);
    });

    it.each(['![outer &Dcaron; ![inner &#35;](/inner.png)](/outer.png)', '![outer &Dcaron; ![inner &#35;](/inner.png)][ref]'])('decodes nested image alt text in %j', (source) => {
        const labels = new Map([['ref', { href: '/outer.png', title: 'title' }]]);
        const tokens = tokenizer(source, { ...options, labels });
        expect(tokens[0]).toMatchObject({ attrs: { alt: 'outer Ď inner #' } });
        expect(generator(tokens)).toBe(source);
    });
});
