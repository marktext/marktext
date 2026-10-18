// @vitest-environment happy-dom

import katexCss from 'katex/dist/katex.css?inline';
import { describe, expect, it } from 'vitest';
import exportCss from '../../assets/styles/exportStyle.css?inline';
import { embedExportFonts } from '../embedExportFonts';

describe('embedExportFonts', () => {
    it('rewrites every @font-face src to an embedded woff2 data URI', () => {
        const out = embedExportFonts(katexCss);

        const faces = out.match(/@font-face\s*\{[^}]*\}/g) ?? [];
        expect(faces.length).toBe(20);
        for (const face of faces) {
            expect(face).toMatch(/src:\s*url\(data:font\/woff2;base64,[^)]+\)\s*format\("woff2"\);/);
        }
    });

    it('drops the now-broken relative font references and woff/ttf fallbacks', () => {
        const out = embedExportFonts(katexCss);

        expect(out).not.toMatch(/url\(\s*fonts\//);
        expect(out).not.toContain('format("woff")');
        expect(out).not.toContain('format("truetype")');
    });

    it('leaves non @font-face css untouched', () => {
        const out = embedExportFonts('.katex { font-size: 1.21em; }');
        expect(out).toBe('.katex { font-size: 1.21em; }');
    });

    it('embeds the notation faces declared by the built-in export stylesheet', () => {
        const out = embedExportFonts(exportCss);
        const faces = out.match(/@font-face\s*\{[^}]*\}/g) ?? [];
        expect(faces).toHaveLength(2);
        for (const face of faces) {
            expect(face).toMatch(/src:\s*url\(data:font\/woff2;base64,[^)]+\)\s*format\("woff2"\);/);
        }
    });
});
