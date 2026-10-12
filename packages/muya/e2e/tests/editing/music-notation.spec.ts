import { readFileSync } from 'node:fs';
import { expect, test } from '../fixtures/muya';

const markdown = readFileSync(new URL('../fixtures/music-notation.md', import.meta.url), 'utf8');

for (const editorFontFamily of [undefined, 'Open Sans']) {
    test(`music notation survives preview with ${editorFontFamily ?? 'default'} fonts (#5327)`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Actual glyph fonts are inspected through Chromium CDP.');

        await page.evaluate(({ markdown, editorFontFamily }) => {
            window.__e2e!.rebuildMuya({ markdown, editorFontFamily });
        }, { markdown, editorFontFamily });

        const notes = page.locator('.mu-editor tr td:nth-child(2)');
        await expect(notes).toHaveText(['Notes', '/𝅗𝅥 ⏜ ♪\\', '/♩^/♩^/♩^', '𝅘𝅥𝅯𝅘𝅥𝅯𝅘𝅥𝅯𝅘𝅥𝅯 𝅘𝅥𝅯𝅘𝅥𝅯𝅘𝅥𝅯𝅘𝅥𝅯 ♪\\', '𝅗𝅥 ⏜ ♪']);
        await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });

        const session = await page.context().newCDPSession(page);
        try {
            await session.send('DOM.enable');
            await session.send('CSS.enable');
            const { root } = await session.send('DOM.getDocument');
            for (const row of [2, 4, 5]) {
                const { nodeIds } = await session.send('DOM.querySelectorAll', {
                    nodeId: root.nodeId,
                    selector: `.mu-editor tr:nth-child(${row}) td:nth-child(2) .mu-plain-text`,
                });
                const fonts = (await Promise.all(nodeIds.map(nodeId => session.send('CSS.getPlatformFontsForNode', { nodeId })))).flatMap(result => result.fonts);
                // DOM text alone also passes when Open Sans draws blank .notdef glyphs.
                expect(fonts.find(font => font.familyName === 'Noto Music')?.glyphCount).toBeGreaterThanOrEqual(row === 4 ? 8 : 1);
                if (row !== 4) {
                    expect(fonts.find(font => font.familyName === 'Noto Sans Math')?.glyphCount).toBeGreaterThanOrEqual(1);
                }
            }
        }
        finally {
            await session.detach();
        }

        const roundTrip = await page.evaluate(() => window.muya!.getMarkdown());
        for (const symbol of ['𝅗𝅥', '𝅘𝅥𝅯', '⏜', '♪', '♩']) {
            expect(roundTrip.split(symbol).length).toBe(markdown.split(symbol).length);
        }
    });
}
