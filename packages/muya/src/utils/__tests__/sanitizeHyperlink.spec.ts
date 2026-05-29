import { describe, expect, it, vi } from 'vitest';

// DOMPurify needs a browser DOM (window) to expose `isValidAttribute`.
// Under Node we stub it to mimic the contract DOMPurify exposes, so the
// wrapper logic can be unit-tested without spinning up jsdom.
//
// The mock approves all schemes except `javascript:` and `vbscript:`,
// which matches DOMPurify's default `ALLOWED_URI_REGEXP`.
const URI_DENY = /^\s*(?:javascript|vbscript|data):/i;
vi.mock('../dompurify', () => ({
    default: (html: string) => html,
    isValidAttribute: (_tag: string, _attr: string, value: string) =>
        typeof value === 'string' && !URI_DENY.test(value),
    Config: undefined,
}));

// Lock in marktext fix 0dd09cc6 (#2548 / #2601): every renderer that
// emits an <a href> (link, referenceLink, autoLink, autoLinkExtension)
// must route the href through `sanitizeHyperlink`. This test exercises
// the wrapper's contract: anything the DOMPurify policy rejects becomes
// the empty string; safe schemes are passed through unchanged.
describe('sanitizeHyperlink — defang dangerous URL schemes', () => {
    it('keeps safe http(s) URLs', async () => {
        const { sanitizeHyperlink } = await import('../url');
        expect(sanitizeHyperlink('https://example.com/path?q=1')).toBe(
            'https://example.com/path?q=1',
        );
        expect(sanitizeHyperlink('http://example.com')).toBe('http://example.com');
    });

    it('keeps mailto: and relative URLs', async () => {
        const { sanitizeHyperlink } = await import('../url');
        expect(sanitizeHyperlink('mailto:a@b.com')).toBe('mailto:a@b.com');
        expect(sanitizeHyperlink('/local/path')).toBe('/local/path');
        expect(sanitizeHyperlink('#section')).toBe('#section');
    });

    it.each([
        ['javascript:alert(1)'],
        ['JavaScript:alert(1)'],
        ['  javascript:alert(1)'], // leading whitespace must not bypass the check
        ['vbscript:alert(1)'],
        ['data:text/html,<script>alert(1)</script>'],
    ])('blocks %s', async (link) => {
        const { sanitizeHyperlink } = await import('../url');
        expect(sanitizeHyperlink(link)).toBe('');
    });

    it('returns "" for empty / non-string input', async () => {
        const { sanitizeHyperlink } = await import('../url');
        expect(sanitizeHyperlink('')).toBe('');
        // @ts-expect-error testing runtime guard against non-string input — guarding against runtime misuse, even if TS disallows
        expect(sanitizeHyperlink(null)).toBe('');
        // @ts-expect-error testing runtime guard against non-string input
        expect(sanitizeHyperlink(undefined)).toBe('');
    });
});
