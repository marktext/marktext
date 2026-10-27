// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { isStandaloneTableHtml } from '../paste';

// #1271: table-only text/plain clipboard content must enter the HTML converter.
describe('standalone table HTML', () => {
    it.each<[string, boolean]>([
        ['<table><tr><td>a</td></tr></table>', true],
        ['  <table border="1"><tr><td>a</td></tr></table>\n', true],
        ['<span>hi</span>', false],
        ['<p>hi</p>', false],
        ['plain string', false],
        ['', false],
        ['<table><tr><td>a</td></tr></table> extra', false],
        ['<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>', false],
        ['<table><tr><td>a</td></tr></table><div>after</div>', false],
    ])('%s → %s', (html, expected) => {
        expect(isStandaloneTableHtml(html)).toBe(expected);
    });

    it('accepts a table when no DOM is available', () => {
        vi.stubGlobal('document', undefined);
        try {
            expect(isStandaloneTableHtml('<table><tr><td>a</td></tr></table>')).toBe(true);
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});
