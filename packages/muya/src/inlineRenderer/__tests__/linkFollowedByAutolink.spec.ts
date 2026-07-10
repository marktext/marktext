// @vitest-environment happy-dom

import type { Token } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// #4671: a well-formed inline/reference link must not be vetoed just because
// its destination URL also matches the GFM extended (bare-URL) autolink rule.
// Extended autolinks are a post-process over plain text and bind LESS tightly
// than a link, so they must never override `[text](url)`.

function linkTokens(src: string) {
    return tokenizer(src).filter(t => t.type === 'link') as Array<Token & { href?: string; anchor?: string }>;
}

describe('inline link followed by trailing punctuation (#4671)', () => {
    it('recognizes a link whose closing paren is followed by a CJK comma', () => {
        const links = linkTokens('支持[CommonMark 规范](https://spec.commonmark.org/)、其他');
        expect(links).toHaveLength(1);
        expect(links[0].href).toBe('https://spec.commonmark.org/');
        expect(links[0].raw).toBe('[CommonMark 规范](https://spec.commonmark.org/)');
    });

    it('recognizes the first of two links on one line', () => {
        const links = linkTokens(
            '支持[CommonMark 规范](https://spec.commonmark.org/)、 [GitHub Flavored Markdown 规范](https://github.github.com/gfm/)',
        );
        expect(links).toHaveLength(2);
        expect(links[0].href).toBe('https://spec.commonmark.org/');
        expect(links[1].href).toBe('https://github.github.com/gfm/');
    });

    it('recognizes a link whose destination URL is immediately followed by text', () => {
        const links = linkTokens('see [docs](https://example.com/path)next');
        expect(links).toHaveLength(1);
        expect(links[0].href).toBe('https://example.com/path');
        expect(links[0].raw).toBe('[docs](https://example.com/path)');
    });
});
