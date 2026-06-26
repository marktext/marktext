// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import HtmlToMarkdown from '../../state/htmlToMarkdown';
import { normalizePastedHTML } from '../paste';

// Bare-URL links need two separate paths: callers can keep the old plain URL
// fallback when auto-link can still recognize it, but preserve the anchor when
// the paste context would otherwise lose link semantics.

function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
    setOnline(true);
});

describe('normalizePastedHTML — bare URL link normalization', () => {
    it('keeps a link whose href is not a URL even when text === href', async () => {
        const out = await normalizePastedHTML('<a href="foo">foo</a>');
        // Non-URL href: the link must survive, not collapse into a bare span.
        expect(out).toContain('href="foo"');
    });

    it('keeps a link whose text differs from its href', async () => {
        const out = await normalizePastedHTML('<a href="http://example.com/">click</a>');
        expect(out).toContain('href="http://example.com/"');
    });

    it('unlinks a bare URL link (text === href) when no page title resolves', async () => {
        // Offline → getPageTitle returns '' immediately → fallback span path.
        // URL_REG needs a path segment after the host, so use `/page`.
        setOnline(false);
        const out = await normalizePastedHTML(
            '<a href="http://example.com/page">http://example.com/page</a>',
        );
        expect(out).not.toContain('<a ');
        expect(out).toContain('http://example.com/page');
    });

    it('keeps a bare URL link when the caller requests preservation', async () => {
        setOnline(false);
        const url = 'http://example.com/page';
        const out = await normalizePastedHTML(`<a href="${url}">${url}</a>`, {
            preserveBareUrlLinks: true,
        });
        const markdown = new HtmlToMarkdown({ bulletListMarker: '-' }).generate(out);

        expect(out).toContain(`href="${url}"`);
        expect(markdown).toContain(`[${url}](${url})`);
    });
});
