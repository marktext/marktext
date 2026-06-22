// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

// The styled-HTML / PDF export path goes through `MarkdownToHtml.renderHtml`,
// which (unlike the spec-conformance `renderToStaticHTML`) historically never
// ran the footnote post-processing. So an exported document left inline `[^id]`
// refs as literal text and footnote definitions as raw
// `<div class="footnote-block">` blocks (the `data-identifier` already stripped
// by DOMPurify) — the bottom footnotes section never appeared. These assert the
// export path now produces the standard GFM / pandoc footnote shape.

const MUYA_FOOTNOTES_ON = {
    options: { math: true, footnote: true },
} as unknown as ConstructorParameters<typeof MarkdownToHtml>[1];

async function renderExport(markdown: string): Promise<string> {
    return new MarkdownToHtml(markdown, MUYA_FOOTNOTES_ON).renderHtml();
}

describe('footnote post-processing in MarkdownToHtml export', () => {
    const MD = [
        'Here is a ref[^1] and another[^2].',
        '',
        '[^1]: First note.',
        '',
        '[^2]: Second note.',
        '',
    ].join('\n');

    it('numbers inline references as <sup class="footnote-ref">', async () => {
        const out = await renderExport(MD);

        expect(out).toMatch(
            /<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1<\/a><\/sup>/,
        );
        expect(out).toMatch(
            /<sup class="footnote-ref"><a href="#fn-2" id="fnref-2">2<\/a><\/sup>/,
        );
        // The literal `[^1]` / `[^2]` markers are gone from the prose.
        expect(out).not.toMatch(/ref\[\^1\]/);
        expect(out).not.toMatch(/another\[\^2\]/);
    });

    it('emits a bottom <section class="footnotes"> with backrefs', async () => {
        const out = await renderExport(MD);

        expect(out).toContain('<section class="footnotes">');
        expect(out).toMatch(/<li id="fn-1">[\s\S]*First note\./);
        expect(out).toMatch(/<li id="fn-2">[\s\S]*Second note\./);
        expect(out).toMatch(/<a href="#fnref-1" class="footnote-backref">↩<\/a>/);
        // The raw footnote-block wrapper must not leak into the output.
        expect(out).not.toContain('footnote-block');
    });
});
