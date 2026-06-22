import { expect, test } from '@playwright/test';
import { loadMarkdown, slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #2177: typing a diagram fence (```mermaid etc.) and pressing Enter must
// create a diagram block. The real typing flow goes through the
// CodeBlockLanguageSelector float (it opens on ```lang and consumes Enter),
// so the conversion must happen there — not only in
// ParagraphContent._enterConvert. This end-to-end test drives the real
// keystroke path that the desktop app uses.

async function typeFenceAndEnter(page: import('@playwright/test').Page, lang: string) {
    await page.goto('/');
    await loadMarkdown(page, 'seed\n');
    const seed = page.locator(editor.paragraph).filter({ hasText: 'seed' }).first();
    await seed.click();
    await page.keyboard.press('End');
    for (let i = 0; i < 4; i++)
        await page.keyboard.press('Backspace');
    await slowType(page, `\`\`\`${lang}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    return page.evaluate(() => window.muya!.getState()[0] as { name: string; meta?: { type?: string; lang?: string } });
}

test('typing ```mermaid + Enter creates a mermaid diagram block', async ({ page }) => {
    const block = await typeFenceAndEnter(page, 'mermaid');
    expect(block.name).toBe('diagram');
    expect(block.meta?.type).toBe('mermaid');
    expect(block.meta?.lang).toBe('yaml');
});

test('typing ```vega-lite + Enter creates a vega-lite diagram block (lang json)', async ({ page }) => {
    const block = await typeFenceAndEnter(page, 'vega-lite');
    expect(block.name).toBe('diagram');
    expect(block.meta?.type).toBe('vega-lite');
    expect(block.meta?.lang).toBe('json');
});

for (const lang of ['flowchart', 'sequence', 'plantuml']) {
    test(`typing \`\`\`${lang} + Enter creates a ${lang} diagram block`, async ({ page }) => {
        const block = await typeFenceAndEnter(page, lang);
        expect(block.name).toBe('diagram');
        expect(block.meta?.type).toBe(lang);
    });
}

test('typing ```js + Enter still creates a fenced code block', async ({ page }) => {
    const block = await typeFenceAndEnter(page, 'js');
    expect(block.name).toBe('code-block');
});
