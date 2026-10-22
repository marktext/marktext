// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

const SAMPLE = '# Getting Started\n\n## Installation\n\nSome **body** text.\n';

async function generateExport(markdown: string): Promise<string> {
    return new MarkdownToHtml(markdown).generate({ title: 'Doc' });
}

describe('parity PG7: export inlines base stylesheets (offline-safe)', () => {
    it(
        'PG7: generated HTML inlines github-markdown-css as a <style> block, not a CDN <link>',
        async () => {
            const out = await generateExport(SAMPLE);

            expect(out).toContain('.markdown-body');
            expect(out).not.toMatch(
                /<link[^>]+href="https:\/\/cdnjs\.cloudflare\.com[^>]+github-markdown-css/,
            );
        },
    );

    it(
        'PG7: generated HTML does not depend on any external CDN stylesheet',
        async () => {
            const out = await generateExport(SAMPLE);

            expect(out).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https:\/\//);
        },
    );
});

describe('export ships the table-of-contents stylesheet', () => {
    // The desktop wrapper injects the `[TOC]` list with `toc-container` /
    // `toc-hN` / `dots` markup but no styles of its own — the styling rides
    // along in the engine's inlined export stylesheet. Without it the exported
    // TOC renders as plain link-blue bullets with no dotted leader (issue 229).
    it('inlines the .toc-container rules (body-colour links + dotted leader)', async () => {
        const out = await generateExport(SAMPLE);

        expect(out).toContain('.toc-container');
        expect(out).toMatch(/\.toc-container ul li span a\s*\{[^}]*color:\s*inherit/);
        expect(out).toMatch(/span\.dots\s*\{[^}]*border-bottom:\s*2px dotted/);
    });
});

describe('parity PG8: exported headings carry slug ids (live TOC anchors)', () => {
    it(
        'PG8: exported <h1>..<hN> carry an id attribute',
        async () => {
            const out = await generateExport(SAMPLE);

            expect(out).toMatch(/<h1[^>]*\sid="[^"]+"/);
            expect(out).toMatch(/<h2[^>]*\sid="[^"]+"/);
        },
    );

    it(
        'PG8: the heading id matches the marktext slug of the heading text',
        async () => {
            const out = await generateExport(SAMPLE);

            // The legacy export + getHtmlToc both slugged "Getting Started" to
            // "getting-started"; the export must emit the same id so anchors
            // line up.
            expect(out).toMatch(/<h1[^>]*\sid="getting-started"/);
            expect(out).toMatch(/<h2[^>]*\sid="installation"/);
        },
    );

    it(
        'PG8: duplicate / chained-collision headings get unique ids',
        async () => {
            // `heading`, `heading`, then a heading literally titled `heading-1`
            // exercises the chained-collision case: naive per-base dedup would
            // emit `heading-1` twice. Every id must be unique so anchors point
            // at exactly one target (matching the legacy Slugger).
            const out = await generateExport(
                '# heading\n\n## heading\n\n## heading-1\n',
            );
            const ids = [...out.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map(
                m => m[1],
            );

            expect(ids).toEqual(['heading', 'heading-1', 'heading-1-1']);
            expect(new Set(ids).size).toBe(ids.length);
        },
    );
});
