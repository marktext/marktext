import { describe, expect, it, vi } from 'vitest';
import { PasteType } from '../../clipboard/types';
import { getCopyTextType, isStandaloneTableHtml, resolveClipboardImagePath } from '../paste';

// Regression for marktext commit 067ec485 (#1271).
// Some clipboard sources (e.g. Apple Numbers, certain spreadsheet
// exporters) put a raw `<table>...</table>` blob in `text/plain` only,
// with no `text/html` flavour. Old behaviour: classified as plain text,
// so the HTML literal ended up inserted verbatim into a paragraph.
// Fix: a sniffing helper that detects the lone-table shape; the paste
// handler promotes such text into the html slot so it goes through the
// HTML→Markdown table converter and a real markdown table comes out.

describe('isStandaloneTableHtml', () => {
    it('matches a single top-level <table>...</table>', () => {
        expect(
            isStandaloneTableHtml(
                '<table><tr><td>a</td></tr></table>',
            ),
        ).toBe(true);
    });

    it('tolerates leading/trailing whitespace and attributes on the opener', () => {
        expect(
            isStandaloneTableHtml(
                '  <table border="1"><tr><td>a</td></tr></table>\n',
            ),
        ).toBe(true);
    });

    it('rejects non-table HTML', () => {
        expect(isStandaloneTableHtml('<span>hi</span>')).toBe(false);
        expect(isStandaloneTableHtml('<p>hi</p>')).toBe(false);
    });

    it('rejects content with trailing text outside the table', () => {
        expect(
            isStandaloneTableHtml(
                '<table><tr><td>a</td></tr></table> extra',
            ),
        ).toBe(false);
    });

    it('rejects plain text and empty strings', () => {
        expect(isStandaloneTableHtml('plain string')).toBe(false);
        expect(isStandaloneTableHtml('')).toBe(false);
    });
});

describe('getCopyTextType — pre-existing classifier behaviour stays put', () => {
    it('returns html when both html and text are present', () => {
        expect(getCopyTextType('<p>x</p>', 'x', PasteType.NORMAL)).toBe('html');
    });

    it('returns code for <p> text-only', () => {
        expect(getCopyTextType('', '<p>hi</p>', PasteType.NORMAL)).toBe('code');
    });

    it('returns text for non-paragraph HTML shape text', () => {
        expect(getCopyTextType('', '<span>hi</span>', PasteType.NORMAL)).toBe('text');
    });

    it('falls back to text for plain strings', () => {
        expect(getCopyTextType('', 'plain string', PasteType.NORMAL)).toBe('text');
    });

    it('pasteAsPlainText ignores html', () => {
        expect(
            getCopyTextType('<p>hi</p>', '<p>hi</p>', PasteType.PASTE_AS_PLAIN_TEXT),
        ).toBe('code');
    });
});

// Ported from the legacy `@muyajs` `clipboardFilePath` paste hook: on paste,
// the embedder may resolve the OS clipboard to a local file path. Only a
// non-empty, image-extension path should short-circuit the normal text/HTML
// paste and be inserted as an inline image.
describe('resolveClipboardImagePath', () => {
    it('returns "" when no hook is provided', async () => {
        expect(await resolveClipboardImagePath(undefined)).toBe('');
    });

    it('returns the path when the hook resolves an image file', async () => {
        const hook = vi.fn().mockResolvedValue('/tmp/screenshot.png');
        expect(await resolveClipboardImagePath(hook)).toBe('/tmp/screenshot.png');
        expect(hook).toHaveBeenCalledOnce();
    });

    it('accepts every supported image extension (case-insensitive)', async () => {
        for (const path of [
            '/a/b.JPG',
            '/a/b.jpeg',
            '/a/b.png',
            '/a/b.gif',
            '/a/b.svg',
            '/a/b.webp',
        ]) {
            expect(await resolveClipboardImagePath(() => Promise.resolve(path))).toBe(
                path,
            );
        }
    });

    it('tolerates a query string after the extension', async () => {
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.png?x=1')),
        ).toBe('/a/b.png?x=1');
    });

    it('returns "" when the hook resolves an empty string', async () => {
        expect(await resolveClipboardImagePath(() => Promise.resolve(''))).toBe('');
    });

    it('returns "" when the resolved path is not an image', async () => {
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.txt')),
        ).toBe('');
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.pdf')),
        ).toBe('');
    });
});
