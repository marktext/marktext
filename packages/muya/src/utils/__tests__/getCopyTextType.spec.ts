import { describe, expect, it } from 'vitest';
import { getCopyTextType, isStandaloneTableHtml } from '../paste';

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
        expect(getCopyTextType('<p>x</p>', 'x', 'normal')).toBe('html');
    });

    it('returns code for <p> text-only', () => {
        expect(getCopyTextType('', '<p>hi</p>', 'normal')).toBe('code');
    });

    it('returns text for non-paragraph HTML shape text', () => {
        expect(getCopyTextType('', '<span>hi</span>', 'normal')).toBe('text');
    });

    it('falls back to text for plain strings', () => {
        expect(getCopyTextType('', 'plain string', 'normal')).toBe('text');
    });

    it('pasteAsPlainText ignores html', () => {
        expect(
            getCopyTextType('<p>hi</p>', '<p>hi</p>', 'pasteAsPlainText'),
        ).toBe('code');
    });
});
