import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('slash quick-insert menu', () => {
    test('typing `/` opens the menu', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
    });

    test('typing a search term filters menu items', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await slowType(page, 'head');
        // After filtering for "head", the atx-heading items remain visible.
        const headingItem = page.locator(quickInsertItem('atx-heading 1'));
        await expect(headingItem).toBeVisible();
    });

    test('clicking a menu item inserts the block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('atx-heading 2')).click();
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
    });
});
