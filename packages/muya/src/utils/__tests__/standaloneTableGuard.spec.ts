// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { isStandaloneTableHtml } from '../paste';

// Track D / sub-item 3: tighten `isStandaloneTableHtml` so the regex match is
// followed by a "exactly one root element" check (legacy
// `pasteCtrl.checkCopyType` parses the blob into a temp container and only
// promotes it when `childElementCount === 1`). A payload whose regex spans two
// sibling `<table>`s (so `<table>...</table>...<table>...</table>` matches the
// greedy `^<table ... </table>$`) is NOT a standalone table and must fall
// through to the normal HTML path.

describe('isStandaloneTableHtml — single-root guard (legacy childElementCount === 1)', () => {
    it('still accepts a genuine lone table', () => {
        expect(
            isStandaloneTableHtml('<table><tr><td>a</td></tr></table>'),
        ).toBe(true);
    });

    it('tolerates leading/trailing whitespace around the single table', () => {
        expect(
            isStandaloneTableHtml('  <table border="1"><tr><td>a</td></tr></table>\n'),
        ).toBe(true);
    });

    it('rejects two sibling tables even though the greedy regex spans them', () => {
        const twoTables
            = '<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>';
        // The greedy `^<table\b[\s\S]*<\/table>$` matches this whole string, but
        // the parsed container has two root elements — not a standalone table.
        expect(isStandaloneTableHtml(twoTables)).toBe(false);
    });

    it('rejects a table followed by a sibling element', () => {
        const tablePlusDiv
            = '<table><tr><td>a</td></tr></table><div>after</div>';
        expect(isStandaloneTableHtml(tablePlusDiv)).toBe(false);
    });

    it('still rejects non-table HTML and plain text', () => {
        expect(isStandaloneTableHtml('<p>hi</p>')).toBe(false);
        expect(isStandaloneTableHtml('plain string')).toBe(false);
        expect(isStandaloneTableHtml('')).toBe(false);
    });
});
