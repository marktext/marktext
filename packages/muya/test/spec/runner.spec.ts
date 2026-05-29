// @vitest-environment happy-dom
// Unit tests for the HTML normalizer that the CommonMark / GFM spec runners
// use to compare actual output against expected. The normalizer must
// canonicalize cosmetic differences (inter-tag whitespace, attribute order,
// void-tag self-closing) without touching semantically-meaningful content
// inside <pre> / <code>.

import { describe, expect, it } from 'vitest';
import { normalizeHtml } from './runner';

describe('normalizeHtml', () => {
    it('collapses whitespace between adjacent tag boundaries', () => {
        // The loose-list spec form: cmark emits `<li>\n<p>foo</p>\n</li>`,
        // marked emits `<li><p>foo</p>\n</li>`. Both must normalise equal.
        const loose = '<ul>\n<li>\n<p>foo</p>\n</li>\n</ul>';
        const tight = '<ul>\n<li><p>foo</p>\n</li>\n</ul>';
        expect(normalizeHtml(loose)).toBe(normalizeHtml(tight));
    });

    it('collapses inter-tag whitespace around block tags', () => {
        const a = '<ul>\n<li>\n<p>foo</p>\n</li>\n<li>\n<p>bar</p>\n</li>\n</ul>';
        const b = '<ul><li><p>foo</p></li><li><p>bar</p></li></ul>';
        expect(normalizeHtml(a)).toBe(normalizeHtml(b));
    });

    it('strips trailing whitespace after self-closing void tags', () => {
        // Hard line break: cmark emits `<br>\nbaz`, marked emits `<br>baz`.
        // Both visually identical, must compare equal.
        const cmark = '<p>foo<br>\nbaz</p>';
        const marked = '<p>foo<br>baz</p>';
        expect(normalizeHtml(cmark)).toBe(normalizeHtml(marked));
    });

    it('preserves content inside <pre><code> blocks', () => {
        // The newline before `</code>` is significant — it's part of the
        // fenced-code-block content. Normalizer must not strip it because
        // `\n<` would otherwise be a candidate for inter-tag collapse.
        const a = '<pre><code>foo\n</code></pre>';
        const b = '<pre><code>bar\n</code></pre>';
        const na = normalizeHtml(a);
        const nb = normalizeHtml(b);
        // Both keep their trailing newline distinguishably:
        expect(na).toContain('foo\n');
        expect(nb).toContain('bar\n');
        expect(na).not.toBe(nb);
    });

    it('preserves multi-blank-line content inside <pre><code>', () => {
        // Code blocks can contain literal blank lines. Two examples that
        // differ only in blank-line count must compare unequal — the
        // normalizer used to collapse `\n{2,}` → `\n` globally, which
        // masked real spec diffs in fenced-code-block examples.
        const oneBlank = '<pre><code>foo\n\nbar\n</code></pre>';
        const twoBlank = '<pre><code>foo\n\n\nbar\n</code></pre>';
        expect(normalizeHtml(oneBlank)).not.toBe(normalizeHtml(twoBlank));
        expect(normalizeHtml(oneBlank)).toContain('foo\n\nbar');
    });

    it('sorts tag attributes alphabetically', () => {
        const a = '<a href="x" title="y">x</a>';
        const b = '<a title="y" href="x">x</a>';
        expect(normalizeHtml(a)).toBe(normalizeHtml(b));
    });

    it('normalises self-closing void tags to a consistent form', () => {
        expect(normalizeHtml('<br>')).toBe(normalizeHtml('<br/>'));
        expect(normalizeHtml('<br>')).toBe(normalizeHtml('<br />'));
        expect(normalizeHtml('<img src="x">')).toBe(normalizeHtml('<img src="x"/>'));
    });

    it('preserves text content that contains whitespace adjacent to tags', () => {
        // `<a>link text</a>` has a space inside the content, between `link`
        // and `text`. The normalizer must NOT collapse it.
        const html = '<p>see <a href="x">link text</a> here</p>';
        expect(normalizeHtml(html)).toContain('link text');
        expect(normalizeHtml(html)).toContain('see ');
    });
});
