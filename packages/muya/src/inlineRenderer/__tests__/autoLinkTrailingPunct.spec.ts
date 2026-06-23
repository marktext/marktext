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
