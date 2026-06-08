// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

// PARITY SCOREBOARD — gaps PG7 (file PG07) + PG8 (file PG08).
//
// PG7: legacy `packages/muyajs` `ExportHtml.generate` inlined
// github-markdown-css, the prism theme, and katex CSS as `<style>…</style>`
// blocks (via `?inline` imports), so exported HTML/PDF/print was fully
// self-contained and rendered offline. `@muyajs/core`'s
// `MarkdownToHtml.generate` instead links those three core stylesheets from
// external CDNs (`<link rel="stylesheet" href="https://…">`). Offline / behind
// CSP / air-gapped, the standalone HTML export is unstyled.
//
// PG8: legacy export rendered each heading as `<hN id="{slug}">` (matching the
// `getHtmlToc` `<a href="#{slug}">` anchors), so in-document [TOC] / TOC links
// worked. `@muyajs/core` renders via stock `marked` with no heading-id
// renderer, so exported `<h1>..<h6>` carry NO id and every TOC anchor is dead.
//
// These assert the export output: the engine now inlines base CSS (PG7) and
// injects github-compatible heading ids (PG8), so they pass.

const SAMPLE = '# Getting Started\n\n## Installation\n\nSome **body** text.\n';

async function generateExport(markdown: string): Promise<string> {
    // `MarkdownToHtml` works without a Muya instance (muya is optional); the
    // export path the desktop wrapper uses calls `.generate({ title, extraCSS })`.
    return new MarkdownToHtml(markdown).generate({ title: 'Doc' });
}

describe('parity PG7: export inlines base stylesheets (offline-safe)', () => {
    it(
        'PG7: generated HTML inlines github-markdown-css as a <style> block, not a CDN <link>',
        async () => {
            const out = await generateExport(SAMPLE);

            // The markdown-body CSS is inlined so the file renders offline.
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

            // Zero external stylesheet links — fully self-contained.
            expect(out).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https:\/\//);
        },
    );
});

describe('parity PG8: exported headings carry slug ids (live TOC anchors)', () => {
    it(
        'PG8: exported <h1>..<hN> carry an id attribute',
        async () => {
            const out = await generateExport(SAMPLE);

            // Headings are emitted with ids so TOC `href="#slug"` anchors
            // resolve.
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
