// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { normalizePastedHTML } from '../paste';

// muyajs `pasteCtrl.normalizePastedHTML` only "unlinks" an <a> whose visible
// text equals its href AND whose href is an actual URL (`URL_REG.test(href) &&
// href === text`). muya was missing the URL_REG guard, so any link whose text
// happened to equal its href — even a non-URL like `<a href="foo">foo</a>` —
// was stripped to a bare span. Restore the guard and sanitize the fallback span.

function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
    setOnline(true);
});

describe('normalizePastedHTML — link unlinking matches muyajs', () => {
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
});
