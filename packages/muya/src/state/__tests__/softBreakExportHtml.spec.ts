// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../../utils/marked';
import { MarkdownToHtml } from '../markdownToHtml';

// #3676 — a soft line break (Shift+Enter, serialized as a bare `\n`
// inside a block) shows as a line break in the editor (`.mu-content` is
// pre-wrap) but was lost on export because marked renders a soft break as a
// space. Rather than emit a non-standard `<br>` (which CommonMark reserves for
// hard breaks), the export keeps the conformant `\n` and renders it with
// `white-space: pre-wrap` on `.markdown-body p` and `li:not(:has(> p))`
// (tight items only).
//
// Because `white-space` inherits, marked's pretty-printing newlines around
// nested block children (`line A\n<ul>`, `<ul>\n<li>`, `</ul>\n</li>`) would
// each render as a visible empty line box under that rule, so the export
// pipeline strips serializer-only whitespace from list/blockquote contexts
// while leaving authored soft breaks (which always have text after them)
// untouched. The pixel-level rendering of both halves is covered by the
// Playwright layout spec (tests/e2e/export-soft-break-layout.spec.ts).

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

describe('export pipeline strips serializer whitespace in pre-wrap list contexts', () => {
    it('a tight item with a nested list carries no formatting newlines', async () => {
        const html = await new MarkdownToHtml('- line A\n  - child\n').renderHtml();

        // marked emits `line A\n<ul>\n<li>child</li>\n</ul>\n</li>`; every one
        // of those newlines is an empty line box under inherited pre-wrap.
        expect(html).toContain('<li>line A<ul><li>child</li></ul></li>');
    });

    it('keeps the authored soft break while stripping the serializer newline', async () => {
        const html = await new MarkdownToHtml('- line A\n  line B\n  - child\n').renderHtml();

        // The `\n` between "line A" and "line B" is the user's; the `\n`
        // between "line B" and the nested list is marked's.
        expect(html).toContain('<li>line A\nline B<ul><li>child</li></ul></li>');
    });

    it('a nested blockquote in a tight item carries no formatting newlines', async () => {
        const html = await new MarkdownToHtml('- line A\n  > quoted\n').renderHtml();

        expect(html).toMatch(/<li>line A<blockquote>\s*<p>quoted<\/p>\s*<\/blockquote><\/li>/);
        // The blockquote's own children are not under the tight-item pre-wrap
        // text path, but strip its formatting whitespace too — `white-space`
        // inherits into it.
        expect(html).not.toMatch(/\n<\/li>/);
    });

    it('preserves the authored space between inline siblings', async () => {
        const html = await new MarkdownToHtml('- **left** **right**\n').renderHtml();

        // The space between the two <strong> elements is authored text, not
        // serializer formatting — removing it would export "leftright".
        expect(html).toContain('<strong>left</strong> <strong>right</strong>');
    });

    it('preserves a soft break whose lines are both wrapped in inline markup', async () => {
        const html = await new MarkdownToHtml('- **left**\n  **right**\n').renderHtml();

        // The newline lives in a whitespace-only text node between two
        // inline siblings — exactly the soft break this feature exists to
        // keep.
        expect(html).toContain('<strong>left</strong>\n<strong>right</strong>');
    });

    it('preserves authored whitespace between inline siblings in a raw blockquote', () => {
        // Raw HTML blockquotes may carry inline flow content directly —
        // unlike marked-generated ones, which always wrap children in
        // blocks. happy-dom's sanitize unwraps top-level blockquotes, so
        // drive the cleanup itself; the real-browser pipeline case lives in
        // e2e/tests/export/serializer-whitespace.spec.ts.
        const container = document.createElement('div');
        container.innerHTML
            = '<blockquote><strong>left</strong> <strong>right</strong></blockquote>';
        (new MarkdownToHtml('') as unknown as {
            _stripListFormattingWhitespace: (c: HTMLElement) => void;
        })._stripListFormattingWhitespace(container);

        expect(container.innerHTML).toBe(
            '<blockquote><strong>left</strong> <strong>right</strong></blockquote>',
        );
    });

    it('a heading as the sole list-item child carries no formatting newline', async () => {
        // marked emits `<li><h1>heading</h1>\n</li>` for `- # heading`; H1
        // must count as a block child or the newline renders as a phantom
        // row under inherited pre-wrap.
        const html = await new MarkdownToHtml('- # heading\n').renderHtml();

        expect(html).toMatch(/<li><h1[^>]*>heading<\/h1><\/li>/);
        expect(html).not.toMatch(/\n<\/li>/);
    });

    it('a thematic break as the sole list-item child carries no formatting newline', async () => {
        const html = await new MarkdownToHtml('- * * *\n').renderHtml();

        expect(html).toContain('<li><hr></li>');
        expect(html).not.toMatch(/\n<\/li>/);
    });

    it('leaves paragraph soft breaks intact through the full pipeline', async () => {
        // happy-dom's DOMPurify pass unwraps the <p> in this environment (a
        // test-runtime artifact — the getHighlightHtml assertion above pins
        // the real markup), so assert only what this suite owns: the strip
        // never touches an authored newline.
        const html = await new MarkdownToHtml('line one\nline two\n').renderHtml();
        expect(html).toContain('line one\nline two');
    });
});
