// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPageTitle, normalizePastedHTML } from '../paste';

// #2525 — copying a bare URL from a browser pastes a markdown link whose anchor
// text is the page `<title>`. The title is fetched as raw HTML, so entities such
// as `&ndash;` / `&uuml;` must be decoded before they become the link text;
// otherwise the literal `&ndash;` shows up in the document.
function mockFetchReturningTitle(titleInnerHtml: string) {
    const body = `<!doctype html><html><head><title>${titleInnerHtml}</title></head><body>x</body></html>`;
    return vi.fn(async () => ({
        status: 200,
        headers: {
            get: (h: string) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
        },
        text: async () => body,
    }));
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('getPageTitle decodes HTML entities (#2525)', () => {
    it('decodes named entities in the fetched page title', async () => {
        vi.stubGlobal(
            'fetch',
            mockFetchReturningTitle('On Statistical Data Compression &ndash; Digitale Bibliothek Th&uuml;ringen'),
        );

        const title = await getPageTitle('https://www.db-thueringen.de/receive/dbt_mods_00027239');

        expect(title).toBe('On Statistical Data Compression – Digitale Bibliothek Thüringen');
    });

    it('a pasted bare URL becomes a link whose anchor text has decoded entities', async () => {
        vi.stubGlobal('fetch', mockFetchReturningTitle('Foo &ndash; B&uuml;cher'));

        const out = await normalizePastedHTML(
            '<a href="https://www.db-thueringen.de/x">https://www.db-thueringen.de/x</a>',
        );

        expect(out).toContain('Foo – Bücher');
        expect(out).not.toContain('ndash');
    });
});
