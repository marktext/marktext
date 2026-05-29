// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../renderToStaticHTML';

// PR-8c — footnote backref + numbered output for `renderToStaticHTML`.
// Builds on the marked footnote extension that already lands the block
// definition as `<div class="footnote-block" data-identifier="…">`, plus
// PR-8a's nested-children parsing. This file pins the post-processed
// shape: `<sup class="footnote-ref"><a href="#fn-N" id="fnref-N">N</a></sup>`
// at each inline reference + a final `<section class="footnotes"><ol>` with
// `<a class="footnote-backref">` arrows on each `<li id="fn-N">`. Numbering
// follows pandoc / GFM convention: by first-occurrence order of inline refs
// (not by where the definitions appear in source).

const PROFILE = { footnote: true } as const;

describe('renderToStaticHTML — footnote backref list (PR-8c)', () => {
    it('emits a <section class="footnotes"> with a <li id="fn-1"> for a single `[^1]` + def pair', () => {
        const html = renderToStaticHTML('foo[^1]\n\n[^1]: bar', PROFILE);

        expect(html).toMatch(/<section class="footnotes">[\s\S]*<\/section>/);
        expect(html).toMatch(/<li id="fn-1">[\s\S]*<\/li>/);
        // Inline ref must point to that li.
        expect(html).toMatch(/<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1<\/a><\/sup>/);
        // Backref arrow on the definition points back to the fnref.
        expect(html).toMatch(/<a href="#fnref-1" class="footnote-backref">/);
        // Body of the definition is preserved.
        expect(html).toContain('bar');
        // The raw `[^1]` text must not survive in the body — it's been
        // rewritten to the sup link.
        expect(html).not.toMatch(/<p>foo\[\^1\]<\/p>/);
        // The inline `<div class="footnote-block" data-identifier="…">` must
        // be hoisted into the section, not left dangling in the body.
        expect(html).not.toMatch(/<div class="footnote-block"/);
    });

    it('numbers inline references in source order, regardless of definition order', () => {
        const md = `A[^second] B[^first].\n\n[^first]: first definition\n\n[^second]: second definition`;
        const html = renderToStaticHTML(md, PROFILE);

        // `[^second]` appears first inline → fn-1; `[^first]` appears second → fn-2.
        expect(html).toMatch(/A<sup class="footnote-ref"><a href="#fn-1"[^>]*>1<\/a><\/sup>/);
        expect(html).toMatch(/B<sup class="footnote-ref"><a href="#fn-2"[^>]*>2<\/a><\/sup>/);
        // The section lists items in numeric (== inline) order, with the
        // matching definition bodies attached.
        const liFn1 = html.match(/<li id="fn-1">([\s\S]*?)<\/li>/)?.[1] ?? '';
        const liFn2 = html.match(/<li id="fn-2">([\s\S]*?)<\/li>/)?.[1] ?? '';
        expect(liFn1).toContain('second definition');
        expect(liFn2).toContain('first definition');
    });

    it('leaves an orphan inline `[^missing]` reference as plain text (no definition to point at)', () => {
        const html = renderToStaticHTML('foo[^missing] bar', PROFILE);

        // No footnote section — there's nothing to list.
        expect(html).not.toMatch(/<section class="footnotes">/);
        // The orphan `[^missing]` stays as a literal token in the paragraph.
        expect(html).toContain('[^missing]');
        // No sup wrapper around it.
        expect(html).not.toMatch(/<sup class="footnote-ref"[^>]*>[^<]*missing/);
    });

    it('points every repeated inline reference to the same `#fn-N` target', () => {
        const md = `First [^x]. Again [^x]. Once more [^x].\n\n[^x]: shared body`;
        const html = renderToStaticHTML(md, PROFILE);

        // All three inline refs must share fn-1.
        const refs = html.match(/<sup class="footnote-ref"><a href="#fn-\d+"[^>]*>\d+<\/a><\/sup>/g) ?? [];
        expect(refs).toHaveLength(3);
        for (const r of refs)
            expect(r).toContain('href="#fn-1"');
        // Only one entry in the list.
        const items = html.match(/<li id="fn-\d+">/g) ?? [];
        expect(items).toEqual(['<li id="fn-1">']);
    });

    it('preserves a footnote definition that contains a nested bullet list inside the <li>', () => {
        const md = `text[^n]\n\n[^n]: intro\n\n    - item a\n    - item b\n`;
        const html = renderToStaticHTML(md, PROFILE);

        // Pin the section contents — naive `<li id="fn-1">…</li>` regex would
        // bail at the first inner `</li>` of the nested list, so check the
        // section slice instead. Everything from `<li id="fn-1">` onward and
        // before the closing `</section>` must include the intro paragraph,
        // the nested list, and both items.
        const sectionMatch = html.match(/<section class="footnotes">[\s\S]*<\/section>/);
        expect(sectionMatch, 'expected a footnotes <section> to be present').not.toBeNull();
        const section = sectionMatch![0];
        expect(section).toContain('<li id="fn-1">');
        expect(section).toContain('intro');
        expect(section).toContain('<ul>');
        expect(section).toMatch(/<li>item a<\/li>/);
        expect(section).toMatch(/<li>item b<\/li>/);
    });

    it('does not transform a literal `[^x]` that sits inside a fenced code block', () => {
        const md = '```\n[^code-only]\n```\n';
        const html = renderToStaticHTML(md, PROFILE);

        // The `[^code-only]` inside a code block is content, not a
        // reference. It must survive as plain text and never become a sup.
        expect(html).toMatch(/\[\^code-only\]/);
        expect(html).not.toMatch(/<sup class="footnote-ref"[^>]*>[^<]*code-only/);
        expect(html).not.toMatch(/<section class="footnotes">/);
    });
});
