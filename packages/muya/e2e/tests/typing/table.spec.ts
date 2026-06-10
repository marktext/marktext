import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem, tablePickerCell } from '../helpers/selectors';

test.describe('table', () => {
    test('typing `| a | b |` + Enter converts paragraph to a table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('| a | b |');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.table).first()).toBeVisible();
    });

    test('slash menu /table opens the grid picker, which creates the picked-size table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('table')).click();

        // The in-editor "table" insert shows the hover-grid dimension picker
        // (TableChessboard) rather than dropping a default table directly.
        const picker = page.locator(floats.tablePicker);
        await expect(picker).toBeVisible();
        await expect(page.locator(editor.table)).toHaveCount(0);

        // Hover then click the zero-based (1, 2) cell -> a 2-row × 3-column
        // table (header row + 1 body row, 3 columns).
        const cell = page.locator(tablePickerCell(1, 2));
        await cell.hover();
        await cell.click();

        const table = page.locator(editor.table).first();
        await expect(table).toBeVisible();
        // The picker dismisses on pick. Like the other muya floats it "hides"
        // via opacity on its `.mu-float-wrapper` parent (the DOM node is not
        // removed), so probe the computed opacity rather than `toBeHidden`.
        const pickerWrapper = page.locator('.mu-float-wrapper', { has: picker });
        await expect
            .poll(() => pickerWrapper.evaluate(el => getComputedStyle(el).opacity))
            .toBe('0');
        // 2 rows total (1 header + 1 body), 3 columns. muya renders every cell
        // as <td> (no <th>/<thead> wrappers — see the cell-typing test below).
        await expect(table.locator('tr')).toHaveCount(2);
        await expect(table.locator('tr').first().locator('td')).toHaveCount(3);
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
