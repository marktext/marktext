import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('blockquote and thematic break', () => {
    test('slash menu creates a block quote', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('block-quote')).click();
        const quote = page.locator(editor.blockQuote).first();
        await expect(quote).toBeVisible();
        // The slash menu only hides via opacity, not display, so we cannot use
        // toBeHidden. Instead we click directly into the new block-quote's
        // inner paragraph, which both moves the cursor and forces focus there.
        await quote.locator(editor.paragraph).first().click();
        await slowType(page, 'quoted');
        await expect(quote.locator(editor.paragraph).first()).toContainText('quoted');
        expect(await getMarkdown(page)).toContain('> quoted');
    });

    test('slash menu creates a thematic break', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('thematic-break')).click();
        await expect(page.locator(editor.thematicBreak).first()).toBeVisible();
    });
});
