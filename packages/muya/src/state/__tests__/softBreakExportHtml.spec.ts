// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../../utils/marked';
import { MarkdownToHtml } from '../markdownToHtml';

// #3676 — a soft line break (Shift+Enter, a bare `\n` inside a block) shows
// as a line break in the editor (`.mu-content` is pre-wrap) but collapsed to
// a space on HTML/PDF export.
//
// The export renders authored soft breaks as `<br>` at the inline TEXT leaf
// (`exportSoftBreaks`) — the only layer where the parser itself
// distinguishes an authored soft break from raw-HTML formatting whitespace
// or its own serializer newlines. CommonMark explicitly permits rendering
// soft breaks as hard line breaks. Everything else in the output is
// byte-for-byte marked-canonical: raw HTML, `&nbsp;`, comments, block
// separators (load-bearing for inline-restyling export themes and for the
// `<p>[TOC]</p>` injector), and the conformance renderer (option off).
//
// The presentation-layer alternative — `white-space: pre-wrap` on container
// elements — was withdrawn: it re-interprets EVERY newline it applies to or
// inherits into, and five review rounds produced counterexample after
// counterexample (serializer phantom rows, raw-HTML collapse, `&nbsp;`
// deletion, inline-restyled themes, raw `<p>`/`<section>` containers).

const OPTS = { math: false, superSubScript: false, footnote: false, frontMatter: false };
const EXPORT = { exportSoftBreaks: true };

describe('#3676 — authored soft breaks render as <br> on export', () => {
    it('renders a paragraph soft break as <br>', () => {
        const html = getHighlightHtml('line one\nline two\n', OPTS, EXPORT);
        expect(html).toContain('<p>line one<br>line two</p>');
    });

    it('renders a tight-item soft break as <br>', () => {
        const html = getHighlightHtml('- line A\n  line B\n', OPTS, EXPORT);
        expect(html).toContain('<li>line A<br>line B</li>');
    });

    it('renders a soft break between inline-wrapped lines as <br>', () => {
        const html = getHighlightHtml('- **left**\n  **right**\n', OPTS, EXPORT);
        expect(html).toContain('<strong>left</strong><br><strong>right</strong>');
    });

    it('renders a soft break inside an inline span as <br>', () => {
        const html = getHighlightHtml('**left\nright**\n', OPTS, EXPORT);
        expect(html).toContain('<strong>left<br>right</strong>');
    });

    it('keeps a real hard break working (two trailing spaces)', () => {
        const html = getHighlightHtml('line one  \nline two\n', OPTS, EXPORT);
        expect(html).toMatch(/line one<br\s*\/?>\s*line two/);
    });

    it('reaches the exported document through the full pipeline', async () => {
        const html = await new MarkdownToHtml('- line A\n  line B\n').renderHtml();
        expect(html).toContain('line A<br>line B');
    });

    it('is off by default — the conformance render keeps the spec newline', () => {
        const html = getHighlightHtml('line one\nline two\n', OPTS);
        expect(html).toContain('<p>line one\nline two</p>');
        expect(html).not.toContain('<br>');
    });
});

describe('everything that is NOT an authored soft break stays marked-canonical', () => {
    it('leaves raw HTML byte-for-byte untouched', () => {
        const raw = '<p>\n<strong>left</strong>\n<strong>right</strong>\n</p>';
        const html = getHighlightHtml(`${raw}\n`, OPTS, EXPORT);
        expect(html).toContain(raw);
    });

    it('leaves raw blockquote inline whitespace untouched', () => {
        const raw = '<blockquote><strong>left</strong> <strong>right</strong></blockquote>';
        const html = getHighlightHtml(`${raw}\n`, OPTS, EXPORT);
        expect(html).toContain(raw);
    });

    it('leaves the newline around an inline comment untouched', () => {
        const html = getHighlightHtml('- left\n  <!-- c -->\n  right\n', OPTS, EXPORT);
        expect(html).toContain('left<!-- c -->\nright');
    });

    it('preserves an authored &nbsp; item next to a nested list', () => {
        const html = getHighlightHtml('- &nbsp;\n  - child\n', OPTS, EXPORT);
        expect(html).toContain('<li>&nbsp;<ul>');
    });

    it('collapses a code-span newline to a space per spec, never <br>', () => {
        const html = getHighlightHtml('a `x\ny` b\n', OPTS, EXPORT);
        expect(html).toContain('<code>x y</code>');
    });

    it('leaves inline raw-text element content untouched (<pre>)', () => {
        // marked flags the interior of inline raw-text elements as
        // `escaped` leaf text - those newlines are CONTENT, not soft
        // breaks, and must never become <br>.
        const html = getHighlightHtml('text <pre>a\nb</pre> more\n', OPTS, EXPORT);
        expect(html).toContain('<pre>a\nb</pre>');
    });

    it('leaves inline raw-text element content untouched (<textarea>)', () => {
        const html = getHighlightHtml(
            'text <textarea>a\nb</textarea> more\n',
            OPTS,
            EXPORT,
        );
        expect(html).toContain('<textarea>a\nb</textarea>');
    });

    it('keeps canonical block separators for inline-restyling themes', () => {
        const html = getHighlightHtml('- # left\n  right\n', OPTS, EXPORT);
        // The `\n` after the heading collapses to the separating space when
        // an export theme restyles headings `display: inline`.
        expect(html).toMatch(/<\/h1>\nright/);
    });

    it('keeps the [TOC] paragraph shape the desktop injector matches', () => {
        const html = getHighlightHtml('[TOC]\n\ntext\n', OPTS, EXPORT);
        expect(html).toContain('<p>[TOC]</p>');
    });
});
