import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('table', () => {
    test('typing `| a | b |` + Enter converts paragraph to a table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('| a | b |');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.table).first()).toBeVisible();
    });

    test('slash menu /table creates a table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('table')).click();
        await expect(page.locator(editor.table).first()).toBeVisible();
    });

    test('typing in a table cell reflects in getMarkdown', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('| h1 | h2 |');
        await page.keyboard.press('Enter');
        const table = page.locator(editor.table).first();
        await expect(table).toBeVisible();
        // muya renders <table><tr>...</tr><tr>...</tr></table> with no
        // <thead>/<tbody> wrappers. The cursor lands in the first body cell
        // (= second <tr>) after table creation.
        const firstBodyCell = table.locator('tr').nth(1).locator('td').first();
        await firstBodyCell.click();
        await slowType(page, 'cell-text');
        await expect(firstBodyCell).toContainText('cell-text');
        const md = await getMarkdown(page);
        expect(md).toContain('cell-text');
    });
});
