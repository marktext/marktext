import { readFileSync, readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

const markdown = '`中文日本語한글 code`\n\n```js\n中文日本語한글 code\n```';
const themeDir = new URL('../../../../desktop/src/renderer/src/assets/themes/', import.meta.url);

async function families(page: Page, inline: string, block: string) {
    return page.evaluate(({ inline, block }) => [inline, block].map(selector =>
        getComputedStyle(document.querySelector(selector)!).fontFamily), { inline, block });
}

async function expectSameGlyphFonts(page: Page, inline: string, block: string) {
    await page.evaluate(() => document.fonts.ready);
    const session = await page.context().newCDPSession(page);
    try {
        await session.send('DOM.enable');
        await session.send('CSS.enable');
        const { root } = await session.send('DOM.getDocument');
        const fontFamilies: string[][] = [];
        for (const selector of [inline, block]) {
            const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
            const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
            fontFamilies.push([...new Set(fonts.map(font => font.familyName))].sort());
        }
        expect(fontFamilies[0].length).toBeGreaterThan(0);
        expect(fontFamilies[0]).toEqual(fontFamilies[1]);
    }
    finally {
        await session.detach();
    }
}

test('inline and block code share defaults and live font changes in every bundled theme (#5773)', async ({ page, browserName }) => {
    await page.evaluate(md => window.muya!.setContent(md), markdown);
    await expect(page.locator('code.mu-inline-rule')).toBeVisible();
    const selectors = ['code.mu-inline-rule', '.mu-codeblock-content'] as const;
    const defaults = await families(page, ...selectors);
    expect(defaults[0]).toEqual(defaults[1]);
    expect(defaults[0]).toContain('DejaVu Sans Mono');
    if (browserName === 'chromium')
        await expectSameGlyphFonts(page, ...selectors);

    const sizes = await page.evaluate(() => ['code.mu-inline-rule', '.mu-codeblock-content'].map(selector =>
        getComputedStyle(document.querySelector(selector)!).fontSize));
    for (const name of readdirSync(themeDir).filter(name => name.endsWith('.theme.css'))) {
        const style = await page.addStyleTag({ content: readFileSync(new URL(name, themeDir), 'utf8') });
        expect(await families(page, ...selectors), name).toEqual(defaults);
        await style.evaluate(node => node.remove());
    }
    const custom = '"Courier New", "PingFang SC", "Microsoft YaHei", monospace';
    await page.evaluate(codeFontFamily => window.muya!.setOptions({ codeFontFamily }), custom);
    const changed = await families(page, ...selectors);
    expect(changed[0]).toEqual(changed[1]);
    expect(changed[0]).toContain('PingFang SC');
    if (browserName === 'chromium')
        await expectSameGlyphFonts(page, ...selectors);
    expect(await page.evaluate(() => ['code.mu-inline-rule', '.mu-codeblock-content'].map(selector =>
        getComputedStyle(document.querySelector(selector)!).fontSize))).toEqual(sizes);
});

for (const theme of ['', 'academic', 'liber']) {
    test(`HTML and PDF share code font fallbacks with ${theme || 'default'} export theme (#5773)`, async ({ page, browser, browserName }) => {
        await page.evaluate(md => window.muya!.setContent(md), markdown);
        for (const custom of [false, true]) {
            if (custom) {
                await page.evaluate(() => window.muya!.setOptions({ codeFontFamily: '"Courier New", "PingFang SC", monospace' }));
            }
            const editor = await families(page, 'code.mu-inline-rule', '.mu-codeblock-content');
            const extraCSS = theme ? readFileSync(new URL(`export/${theme}.theme.css`, themeDir), 'utf8') : '';
            const html = await page.evaluate(async ({ markdown, extraCSS }) =>
                new window.MarkdownToHtml!(markdown, window.muya!).generate({ extraCSS }), { markdown, extraCSS });
            const exported = await browser.newPage({ offline: true });
            try {
                await exported.setContent(html);
                for (const media of ['screen', 'print'] as const) {
                    await exported.emulateMedia({ media });
                    expect(await families(exported, 'p code', 'pre code')).toEqual(editor);
                }
                if (browserName === 'chromium') {
                    await expectSameGlyphFonts(exported, 'p code', 'pre code');
                    const pdf = await exported.pdf();
                    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
                }
            }
            finally {
                await exported.close();
            }
        }
    });
}
