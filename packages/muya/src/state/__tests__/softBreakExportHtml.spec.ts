import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../../utils/marked';

// #3676 — a soft line break (Shift+Enter, serialized as a bare `\n` inside a
// block) shows as a line break in the editor (`.mu-content` is pre-wrap) but
// was lost on export because marked renders a soft break as a space. Rather
// than emit a non-standard `<br>` (which CommonMark reserves for hard breaks),
// the export keeps the conformant `\n` and renders it with `white-space:
// pre-wrap` on `.markdown-body p` and `li:not(:has(> p))` (tight items only).
//
// These assert the HTML stays conformant — the soft break is a preserved
// newline, never a `<br>`, and hard breaks are untouched. The pre-wrap
// rendering itself (and the `:has()` exclusion of loose items) is a CSS
// concern verified in a real browser against the export stylesheet.

const OPTS = { math: false, superSubScript: false, footnote: false, frontMatter: false };

describe('#3676 — soft line breaks survive export as a conformant newline', () => {
    it('keeps a paragraph soft break as a newline, never a <br>', () => {
        const html = getHighlightHtml('line one\nline two', OPTS);
        expect(html).toContain('<p>line one\nline two</p>');
        expect(html).not.toMatch(/<br\s*\/?>/);
    });

    it('keeps a soft break inside a tight list item, never a <br>', () => {
        const html = getHighlightHtml('- line A\n  line B', OPTS);
        expect(html).toMatch(/<li>line A\nline B<\/li>/);
        expect(html).not.toMatch(/<br\s*\/?>/);
    });

    it('leaves a real hard break (two trailing spaces) as <br>', () => {
        // Sanity: the change only touches soft breaks; hard breaks are untouched.
        const html = getHighlightHtml('line one  \nline two', OPTS);
        expect(html).toMatch(/<br\s*\/?>/);
    });
});
