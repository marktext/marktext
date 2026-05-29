import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('paragraphs and headings', () => {
    test('typing in a paragraph reflects in getMarkdown', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello'));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await page.keyboard.press('End');
        await slowType(page, ' world');
        await expect(para).toContainText('hello world');
        expect(await getMarkdown(page)).toContain('hello world');
    });

    test('slash menu converts an empty paragraph to atx-heading level 1', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('atx-heading 1')).click();
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
    });

    test('setContent with a setext heading renders correctly', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'setext-heading',
                meta: { level: 1, underline: '===' },
                text: 'Setext Title',
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        await expect(page.locator(editor.setextHeading).first()).toBeVisible();
        expect(await getMarkdown(page)).toContain('Setext Title');
    });
});
