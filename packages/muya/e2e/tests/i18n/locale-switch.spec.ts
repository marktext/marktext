import { expect, test } from '../fixtures/muya';
import { editor, floats, toolbar } from '../helpers/selectors';

test.describe('locale switch', () => {
    test('switching to zh-CN flips muya.i18n.lang', async ({ page }) => {
        const initial = await page.evaluate(() => window.muya!.i18n.lang);
        expect(initial).toBe('en');
        await page.locator(toolbar.languageSelect).selectOption('zh-CN');
        const after = await page.evaluate(() => window.muya!.i18n.lang);
        expect(after).toBe('zh-CN');
    });

    test('switching to ja flips muya.i18n.lang', async ({ page }) => {
        await page.locator(toolbar.languageSelect).selectOption('ja');
        const after = await page.evaluate(() => window.muya!.i18n.lang);
        expect(after).toBe('ja');
    });

    test('locale change is reflected in slash menu item labels', async ({ page }) => {
        await page.locator(toolbar.languageSelect).selectOption('zh-CN');
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        // Whatever the exact translated string is, it should not be the
        // English "BASIC BLOCKS" anymore (the section title is uppercased en).
        const titleText = await page.locator(`${floats.quickInsert} .title`).first().textContent();
        expect(titleText).not.toBe('BASIC BLOCKS');
    });
});
