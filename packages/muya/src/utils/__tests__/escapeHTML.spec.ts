import { describe, expect, it } from 'vitest';
import { escapeHTML, unescapeHTML } from '../index';

// Lock in marktext fix dc54c7b6 (#2967, "escape html in code block"). The
// rewritten implementation escapes `&` first (so existing `&amp;` etc.
// in the input survive a round-trip) and covers all five XML entities.
describe('escapeHTML / unescapeHTML', () => {
    it('escapes all five entities', () => {
        expect(escapeHTML('<')).toBe('&lt;');
        expect(escapeHTML('>')).toBe('&gt;');
        expect(escapeHTML('"')).toBe('&quot;');
        expect(escapeHTML('\'')).toBe('&#39;');
        expect(escapeHTML('&')).toBe('&amp;');
    });

    it('escapes & first (pre-dc54c7b6 forgot &, which broke round-trips)', () => {
        // Pre-fix bug: escapeHtml('&lt;') would return '&lt;' unchanged
        // (no & escape), then unescapeHtml would turn it into '<' —
        // an information loss. The new impl encodes the leading & so
        // the original entity survives a round trip.
        const round = unescapeHTML(escapeHTML('&lt;'));
        expect(round).toBe('&lt;');
    });

    it('does not double-escape an already-escaped string round-tripped through unescape', () => {
        const malicious = '<script>alert("x")</script>';
        const escaped = escapeHTML(malicious);
        expect(escaped).toBe(
            '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
        );
        expect(unescapeHTML(escaped)).toBe(malicious);
    });

    it('preserves benign text untouched', () => {
        expect(escapeHTML('hello world')).toBe('hello world');
        expect(escapeHTML('')).toBe('');
    });
});
