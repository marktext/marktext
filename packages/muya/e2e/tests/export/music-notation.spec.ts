import { readFileSync } from 'node:fs';
import { expect, test } from '../fixtures/muya';

const markdown = readFileSync(new URL('../fixtures/music-notation.md', import.meta.url), 'utf8');

test('exports include notation fonts even without music symbols', async ({ page }) => {
    const html = await page.evaluate(async () => new window.MarkdownToHtml!('Plain text').generate());
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toMatch(/font-family:\s*['"]Noto Music['"]/);
    expect(html).toMatch(/font-family:\s*['"]Noto Sans Math['"]/);
});

test('external export CSS is preserved verbatim', async ({ page }) => {
    const css = '.markdown-body { font-family: "External Font" !important; }';
    const html = await page.evaluate(async css => new window.MarkdownToHtml!('Text').generate({ extraCSS: css }), css);
    expect(html).toContain(`<style>${css}</style>`);
});

const exportStyles = [
    { name: 'default', css: '' },
    { name: 'font override', css: '.markdown-body { font-family: "Noto Music", "Noto Sans Math", "Open Sans", sans-serif !important; }' },
    ...['academic', 'liber'].map(name => ({
        name,
        css: readFileSync(new URL(`../../../../desktop/src/renderer/src/assets/themes/export/${name}.theme.css`, import.meta.url), 'utf8'),
    })),
];

for (const { name, css: extraCSS } of exportStyles) {
    test(`offline HTML and PDF retain music glyphs with ${name} fonts (#5327)`, async ({ page, browser, browserName }) => {
        test.skip(browserName !== 'chromium', 'PDF and actual glyph font checks require Chromium.');
        const html = await page.evaluate(async ({ markdown, extraCSS }) => {
            return new window.MarkdownToHtml!(markdown).generate({ extraCSS });
        }, { markdown, extraCSS });
        expect(html).toContain('data:font/woff2;base64,');

        const context = await browser.newContext({ offline: true });
        try {
            const exported = await context.newPage();
            await exported.setContent(html);
            await exported.evaluate(async () => {
                await Promise.all([
                    document.fonts.load('16px "Noto Music"', '𝅗𝅥𝅘𝅥𝅯'),
                    document.fonts.load('16px "Noto Sans Math"', '⏜⏝'),
                ]);
                await document.fonts.ready;
                await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            });
            await expect(exported.locator('tbody tr').first().locator('td').nth(1)).toHaveText('/𝅗𝅥 ⏜ ♪\\');

            const session = await context.newCDPSession(exported);
            await session.send('DOM.enable');
            await session.send('CSS.enable');
            const { root } = await session.send('DOM.getDocument');
            const { nodeId } = await session.send('DOM.querySelector', {
                nodeId: root.nodeId,
                selector: 'tbody tr:first-child td:nth-child(2)',
            });
            const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
            expect(fonts.find(font => font.familyName === 'Noto Music')?.glyphCount).toBeGreaterThanOrEqual(1);
            expect(fonts.find(font => font.familyName === 'Noto Sans Math')?.glyphCount).toBeGreaterThanOrEqual(1);
            const loaded = await exported.evaluate(async () => {
                return Promise.all([
                    document.fonts.load('16px "Noto Music"', '𝅗𝅥𝅘𝅥𝅯').then(faces => faces.length),
                    document.fonts.load('16px "Noto Sans Math"', '⏜⏝').then(faces => faces.length),
                ]);
            });
            expect(loaded).toEqual([1, 1]);
            await session.detach();

            const pdf = await exported.pdf();
            expect(pdf.toString('latin1')).toContain('NotoMusic-Regular');
            expect(pdf.toString('latin1')).toContain('NotoSansMath-Regular');
        }
        finally {
            await context.close();
        }
    });
}
