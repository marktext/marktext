// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer, tokensToInlineHtml, tokensToPlainText } from '../lexer';

const options = {
    superSubScript: true,
    footnote: true,
    texMathDollars: true,
    texMathGfm: true,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: true,
    inlineDiff: true,
};

describe('outline text and HTML keep the same visible content', () => {
    it.each([
        ['a < b & c', 'a < b & c', 'a &lt; b &amp; c'],
        ['**bold *em***', 'bold em', '<strong>bold <em>em</em></strong>'],
        ['~~cut~~ ==mark==', 'cut mark', '<del>cut</del> <mark>mark</mark>'],
        ['`a < b`', 'a < b', '<code>a &lt; b</code>'],
        ['{+ a < b +} [-gone-]', ' a < b  gone', '<ins class="idiff addition"> a &lt; b </ins> <del class="idiff deletion">gone</del>'],
        ['^up^ ~down~', 'up down', '<sup>up</sup> <sub>down</sub>'],
        ['$a<b$', 'a<b', 'a&lt;b'],
        ['$`a<b`$', 'a<b', 'a&lt;b'],
        [':ok: :unknown_shortcode:', '🆗 :unknown_shortcode:', '🆗 :unknown_shortcode:'],
        ['[**link**](https://example.com)', 'link', '<strong>link</strong>'],
        ['![a & b](image.png)', 'a & b', 'a &amp; b'],
        ['[**ref**][label] ![a & b][label]', 'ref a & b', '<strong>ref</strong> a &amp; b'],
        ['<b>raw &amp; **bold**</b>', 'raw & bold', 'raw &amp; <strong>bold</strong>'],
        ['\\* &amp; &unknown;', '* & &unknown;', '* &amp; &amp;unknown;'],
        ['<https://example.com?a=1&b=2>', 'https://example.com?a=1&b=2', 'https://example.com?a=1&amp;b=2'],
        ['<a@example.com>', 'a@example.com', 'a@example.com'],
        ['https://example.com?a=1&b=2', 'https://example.com?a=1&b=2', 'https://example.com?a=1&amp;b=2'],
        ['one\ntwo  \nthree', 'one two three', 'one two three'],
        ['# heading #', 'heading', 'heading'],
        ['[label]: https://example.com', '', ''],
    ])('renders %j without leaking source markers or unsafe HTML', (markdown, text, html) => {
        const tokens = tokenizer(markdown, {
            options,
            labels: new Map([['label', { href: 'https://example.com', title: '' }]]),
        });

        expect(tokensToPlainText(tokens)).toBe(text);
        expect(tokensToInlineHtml(tokens)).toBe(html);
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.textContent).toBe(text);
    });
});
