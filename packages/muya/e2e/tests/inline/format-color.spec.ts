import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

async function selectAllOfFirstParagraph(page: Page) {
    const para = page.locator(editor.paragraph).first();
    await para.click({ clickCount: 3 });
    return para;
}

async function openPicker(page: Page) {
    await page.locator(floats.colorToggle).hover();
    await expect(page.locator(floats.colorPicker)).toBeVisible();
}

function swatch(type: 'text' | 'bg', value: string) {
    const base = type === 'text' ? floats.colorSwatchText : floats.colorSwatchBg;
    return `${floats.colorPicker} ${base}[data-color="${value}"]`;
}

test.describe('inline colour picker', () => {
    test('the colour button reveals the picker on hover', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();

        await openPicker(page);
        await expect(page.locator(floats.colorReset)).toBeVisible();
    });

    test('hovering the A alone does not open the picker', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);

        await page.locator(floats.colorButton).hover();
        await expect(page.locator(floats.colorPicker)).toBeHidden();
    });

    test('choosing a text colour wraps the selection in a colour span', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);

        await page.locator(swatch('text', '#e64340')).click();

        expect(await getMarkdown(page)).toContain(
            '<span style="color:#e64340">hello world</span>',
        );
    });

    test('choosing a background colour wraps the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);

        await page.locator(swatch('bg', '#fde2e2')).click();

        expect(await getMarkdown(page)).toContain(
            '<span style="background-color:#fde2e2">hello world</span>',
        );
    });

    test('re-picking the applied colour returns the run to the default', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);

        const red = page.locator(swatch('text', '#e64340'));
        await red.click();
        await red.click();

        const md = await getMarkdown(page);
        expect(md).not.toContain('<span');
        expect(md).toContain('hello world');
    });

    test('text and background colour merge into a single span', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);

        await page.locator(swatch('bg', '#fde2e2')).click();
        await page.locator(swatch('text', '#e64340')).click();

        expect(await getMarkdown(page)).toContain(
            '<span style="color:#e64340;background-color:#fde2e2">hello world</span>',
        );
    });

    test('Reset clears both colours', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);

        await page.locator(swatch('bg', '#fde2e2')).click();
        await page.locator(swatch('text', '#e64340')).click();
        await page.locator(floats.colorReset).click();

        const md = await getMarkdown(page);
        expect(md).not.toContain('<span');
        expect(md).toContain('hello world');
    });

    test('the button preview follows the current selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('aaa\n\nbbb'));
        const first = page.locator(editor.paragraph).nth(0);
        await first.click({ clickCount: 3 });
        await openPicker(page);
        await page.locator(swatch('bg', '#fde2e2')).click();

        await expect(page.locator(floats.colorButton)).toHaveAttribute(
            'style',
            /background-color/,
        );

        await page.locator(editor.paragraph).nth(1).click({ clickCount: 3 });
        await expect(page.locator(floats.colorButton)).not.toHaveAttribute(
            'style',
            /background-color/,
        );
    });

    test('clicking the A clears both colours, like Reset', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await openPicker(page);
        await page.locator(swatch('bg', '#fde2e2')).click();
        await page.locator(swatch('text', '#e64340')).click();

        await page.locator(floats.colorButton).click();

        const md = await getMarkdown(page);
        expect(md).not.toContain('<span');
        expect(md).toContain('hello world');
    });
});
