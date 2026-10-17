// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

// #5767 — the export renders tight list items with `white-space: pre-wrap` so
// soft line breaks survive (#3676). A nested list inherits that, so the
// newlines marked pretty-prints between its items, and after its closing tag,
// showed up as a blank line after every nested item in exported HTML / PDF.
// The rendered spacing itself is checked in a real browser by the muya-e2e
// `export/nested-list-spacing` spec.

const render = (markdown: string) => new MarkdownToHtml(markdown).renderHtml();

describe('#5767 — nested lists export without formatting whitespace', () => {
    it('drops the newlines inside and after a nested bullet list', async () => {
        const html = await render('- one\n- two\n    - three\n    - four\n- five\n');
        expect(html).toContain('<li>two<ul><li>three</li><li>four</li></ul></li>');
    });

    it('drops the newlines inside and after a nested ordered list', async () => {
        const html = await render('1. one\n2. two\n    1. three\n    2. four\n3. five\n');
        expect(html).toContain('<li>two<ol><li>three</li><li>four</li></ol></li>');
    });

    it('handles several nesting levels', async () => {
        const html = await render('- one\n    - two\n        - three\n        - four\n    - five\n');
        expect(html).toContain('<li>one<ul><li>two<ul><li>three</li><li>four</li></ul></li><li>five</li></ul></li>');
    });

    it('keeps a soft line break in a tight item that holds a nested list', async () => {
        const html = await render('- line A\n  line B\n    - nested\n');
        expect(html).toContain('<li>line A\nline B<ul><li>nested</li></ul></li>');
    });

    it('leaves top-level lists untouched', async () => {
        const html = await render('- one\n- two\n');
        expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    });
});
