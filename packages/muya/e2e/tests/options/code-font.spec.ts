import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

/**
 * Code-block font options reaching the rendered code, and the line-number
 * gutter re-measuring when those options change.
 *
 * The code text is rendered as `<code class="mu-code"><span
 * class="mu-codeblock-content">…`. The `<code>` element's user-agent
 * `font-family: monospace` overrides the inherited block font, so
 * `--mu-code-font-family` (set on the editor root) only reached `.mu-code-block`
 * (the `<pre>`) and never the text — changing the code font had no visible
 * effect. `.mu-code-block .mu-code { font-family: inherit }` re-opens the
 * cascade. `font-size` was unaffected because the UA `<code>` rule sets no
 * size, so it kept inheriting.
 *
 * Separately, the line-number gutter is positioned by measuring each line's
 * pixel top (`repositionLineNumberSpans`), which only re-ran on text edits — a
 * code-font / size / wrap change left the numbers misaligned until `setOptions`
 * re-measured them.
 */

// The host boots with `codeBlockLineNumbers: true`, so the gutter renders.
const CODE_MD = '```js\nconst a = 1\nconst b = 2\nconst c = 3\n```\n';

// Measured `top` of the 3rd line number (the gutter is positioned, not derived).
const thirdLineTop = (page: Page) => page.evaluate(() => {
    const spans = document.querySelectorAll<HTMLElement>('.mu-line-numbers-rows span');
    return Number.parseFloat(spans[2]?.style.top || '0');
});

test.describe('code-block font options', () => {
    test('codeFontFamily reaches the code text element', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), CODE_MD);
        await page.waitForSelector('.mu-codeblock-content');

        const family = () => page.evaluate(() =>
            getComputedStyle(document.querySelector('.mu-codeblock-content')!).fontFamily);

        // Default: the bundled DejaVu stack inherited from the block (not the
        // browser's bare `monospace`).
        await expect.poll(family).toContain('DejaVu Sans Mono');

        await page.evaluate(() =>
            window.muya!.setOptions({ codeFontFamily: 'Courier New, monospace' }));

        await expect.poll(family).toContain('Courier New');
    });

    test('changing code font size re-measures the line-number gutter', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), CODE_MD);
        await page.waitForSelector('.mu-line-numbers-rows span');

        // Wait for the initial line-number positioning.
        await expect.poll(() => thirdLineTop(page)).toBeGreaterThan(0);
        const before = await thirdLineTop(page);

        await page.evaluate(() => window.muya!.setOptions({ codeFontSize: 30 }));

        // The 3rd line number must move down to track the taller lines.
        await expect.poll(() => thirdLineTop(page)).toBeGreaterThan(before + 5);
    });

    test('editor font size also re-measures the line-number gutter', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), CODE_MD);
        await page.waitForSelector('.mu-line-numbers-rows span');

        await expect.poll(() => thirdLineTop(page)).toBeGreaterThan(0);
        const before = await thirdLineTop(page);

        // The code block font is relative (`90%`), so the editor base font
        // change enlarges the code lines — the gutter must track them.
        await page.evaluate(() => window.muya!.setOptions({ fontSize: 30 }));

        await expect.poll(() => thirdLineTop(page)).toBeGreaterThan(before + 5);
    });

    test('wrapCodeBlocks wraps long lines', async ({ page }) => {
        const longLine = `\`\`\`js\nconst x = "${'a'.repeat(160)}"\n\`\`\`\n`;
        await page.evaluate(md => window.muya!.setContent(md), longLine);
        await page.waitForSelector('.mu-code-block .mu-code');

        const overflowing = () => page.evaluate(() => {
            const code = document.querySelector('.mu-code-block .mu-code') as HTMLElement;
            return code.scrollWidth > code.clientWidth + 2;
        });

        // Off: the long line overflows horizontally.
        await expect.poll(overflowing).toBe(true);

        await page.evaluate(() => window.muya!.setOptions({ wrapCodeBlocks: true }));
        await expect.poll(overflowing).toBe(false);

        await page.evaluate(() => window.muya!.setOptions({ wrapCodeBlocks: false }));
        await expect.poll(overflowing).toBe(true);
    });
});
