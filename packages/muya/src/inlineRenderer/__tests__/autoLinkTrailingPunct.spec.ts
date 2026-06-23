// @vitest-environment happy-dom

import type { Token } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// #2096: an extended (bare) autolink swallowed trailing punctuation because the
// path component matched `\S+`. Per GFM §6.9, trailing punctuation
// (?!.,:*_~) must not be part of the link.

function autoLinkExt(src: string) {
    const token = tokenizer(src).find(t => t.type === 'auto_link_extension') as
        | (Token & { url?: string; www?: string; raw: string })
        | undefined;
    return token;
}

describe('extended autolink — trailing punctuation (#2096)', () => {
    it('excludes a trailing colon from the link', () => {
        const token = autoLinkExt('http://some.domain.name/path/to/resource: rest');
        expect(token).toBeDefined();
        expect(token!.url).toBe('http://some.domain.name/path/to/resource');
        expect(token!.raw).toBe('http://some.domain.name/path/to/resource');
    });

    it('excludes a trailing period (sentence end)', () => {
        const token = autoLinkExt('https://example.com/a/b. Next sentence.');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/a/b');
    });

    it('keeps interior punctuation, only trims the trailing run', () => {
        const token = autoLinkExt('https://example.com/a:b:c! end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/a:b:c');
    });

    it('leaves a clean URL untouched', () => {
        const token = autoLinkExt('https://example.com/a/b end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/a/b');
    });
});

// GFM §6.9 also trims the link extent for three further cases. The match is
// greedy (`\S+`) so these all need post-match trimming, not regex.
describe('extended autolink — GFM §6.9 extent trimming', () => {
    // Rule: an unmatched trailing `)` is excluded when the link has more `)`
    // than `(`, so an autolink can sit inside parentheses.
    it('excludes a trailing ) when parens are unbalanced', () => {
        const token = autoLinkExt('(https://en.wikipedia.org/wiki/Foo_(bar)) end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    });

    it('keeps a trailing ) when parens are balanced', () => {
        const token = autoLinkExt('https://example.com/foo(bar) end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/foo(bar)');
    });

    // Rule: a trailing `;` closing an `&entity;`-looking reference is excluded.
    it('excludes a trailing &entity; reference', () => {
        const token = autoLinkExt('https://example.com/foo?bar=1&amp; end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/foo?bar=1');
    });

    it('keeps a bare trailing ; that is not an entity', () => {
        const token = autoLinkExt('https://example.com/a;b; end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/a;b;');
    });

    // Rule: a `<` ends the autolink.
    it('ends the link at a < character', () => {
        const token = autoLinkExt('https://example.com/a<b end');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/a');
    });

    // The rules interleave and apply repeatedly: ").": trim '.' then the now-
    // unbalanced ')'.
    it('applies the rules repeatedly (trailing ").")', () => {
        const token = autoLinkExt('(see https://example.com/path). rest');
        expect(token).toBeDefined();
        expect(token!.url).toBe('https://example.com/path');
    });
});
