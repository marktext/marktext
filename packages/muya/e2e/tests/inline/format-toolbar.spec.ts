import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

async function selectAllOfFirstParagraph(page: import('@playwright/test').Page) {
    const para = page.locator(editor.paragraph).first();
    // Triple-click to select the full paragraph text — this is the standard
    // browser gesture that fires selectionchange so the IFT pops up.
    await para.click({ clickCount: 3 });
    return para;
}

test.describe('inline format toolbar', () => {
    test('appears on text selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();
    });

    test('clicking the strong button wraps the selection in **bold**', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();
        await page.locator(`${floats.inlineFormatToolbar} li.item.strong`).click();
        const md = await getMarkdown(page);
        expect(md).toContain('**hello world**');
    });

    test('clicking the em button wraps the selection in *italic*', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('alpha'));
        await selectAllOfFirstParagraph(page);
        await page.locator(`${floats.inlineFormatToolbar} li.item.em`).click();
        const md = await getMarkdown(page);
        expect(md).toMatch(/[*_]alpha[*_]/);
    });
});
