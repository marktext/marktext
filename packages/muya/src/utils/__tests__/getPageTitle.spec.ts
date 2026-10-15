// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        vi.useRealTimers();
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
    it('uses host HTML transport while keeping title parsing in Muya', async () => {
        const { getPageTitle } = await import('../paste');
        const fetchLinkHtml = vi.fn().mockResolvedValue('<title>Host &amp; browser</title>');
        expect(await getPageTitle('https://example.com', fetchLinkHtml)).toBe('Host & browser');
        expect(fetchLinkHtml).toHaveBeenCalledWith('https://example.com');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not use renderer online status to block the host transport', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const { getPageTitle } = await import('../paste');
        expect(await getPageTitle('https://example.com', async () => '<title>Host</title>')).toBe('Host');
    });

    it('falls back when the host transport rejects', async () => {
        const { getPageTitle } = await import('../paste');
        expect(await getPageTitle('https://example.com', async () => {
            throw new Error('offline');
        })).toBe('');
    });

    it('bounds a host transport that never resolves', async () => {
        vi.useFakeTimers();
        const { getPageTitle } = await import('../paste');
        const result = getPageTitle('https://example.com', () => new Promise(() => {}));
        await vi.advanceTimersByTimeAsync(1500);
        expect(await result).toBe('');
    });

    it('aborts browser fetch on timeout and clears the timer', async () => {
        vi.useFakeTimers();
        fetchSpy.mockImplementation(() => new Promise(() => {}));
        const { getPageTitle } = await import('../paste');
        const result = getPageTitle('https://example.com');
        await vi.advanceTimersByTimeAsync(1500);
        expect(await result).toBe('');
        expect(fetchSpy.mock.calls[0][1].signal.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
