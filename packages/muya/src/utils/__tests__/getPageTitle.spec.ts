// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression for marktext commit 141d25d8 (#1344).
// `getPageTitle` is meant to fetch a URL, parse the `<title>` out of the
// HTML body, and return it so a pasted bare URL renders as a link with
// the page's real title. The current impl pipes the HTML body through
// `res.json()`, which throws on every text/html response — so the
// helper always swallows the error and returns ''. The fix uses
// `res.text()`.

function htmlResponse(html: string) {
    return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

describe('getPageTitle — parses <title> from HTML', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true, userAgent: 'node-test' });
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('returns the <title> contents for an http(s) URL with a 200 text/html response', async () => {
        fetchSpy.mockResolvedValueOnce(
            htmlResponse('<html><head><title>Example Domain</title></head><body>x</body></html>'),
        );
        const { getPageTitle } = await import('../paste');

        const title = await getPageTitle('https://example.com/');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(title).toBe('Example Domain');
    });

    it('returns empty string when URL does not start with http', async () => {
        const { getPageTitle } = await import('../paste');

        const title = await getPageTitle('file:///etc/passwd');

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(title).toBe('');
    });

    it('returns empty string when offline', async () => {
        vi.stubGlobal('navigator', { onLine: false, userAgent: 'node-test' });
        const { getPageTitle } = await import('../paste');

        const title = await getPageTitle('https://example.com/');

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(title).toBe('');
    });

    it('returns empty string when the response is not text/html', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response('{"hi":1}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );
        const { getPageTitle } = await import('../paste');

        const title = await getPageTitle('https://example.com/api');

        expect(title).toBe('');
    });

    it('returns empty string on fetch error', async () => {
        fetchSpy.mockRejectedValueOnce(new Error('network'));
        const { getPageTitle } = await import('../paste');

        const title = await getPageTitle('https://example.com/');

        expect(title).toBe('');
    });
});
