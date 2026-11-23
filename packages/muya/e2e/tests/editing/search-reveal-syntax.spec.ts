import { expect, test } from '../fixtures/muya';

const highlights = '.mu-editor .mu-highlight, .mu-editor .mu-selection';

test.describe('Find matches inside hidden syntax', () => {
    test('every match inside an entity is visible, and stays visible after clicking another match', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('R&amp;D one, R&amp;D two, R&amp;D three\n');
            window.muya!.editor.searchModule.search('&', { selectHighlight: true });
        });

        const matches = page.locator(highlights);
        await expect(matches).toHaveCount(3);
        for (const match of await matches.all())
            await expect(match).toBeVisible();

        // The editor re-renders the block when the caret enters syntax; that render must keep the highlights.
        await matches.nth(1).click();
        await expect(matches).toHaveCount(3);
        for (const match of await matches.all())
            await expect(match).toBeVisible();
    });

    test('a match in a hidden link destination is visible', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('See [link](https://needle.test) here\n');
            window.muya!.editor.searchModule.search('needle');
        });
        await expect(page.locator(highlights)).toHaveText(['needle']);
        await expect(page.locator(highlights)).toBeVisible();
    });
});
