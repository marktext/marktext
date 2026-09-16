import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5386: forward Delete at the end of a table's last cell merges the next
// paragraph into the cell. The blocks after that paragraph were moved into the
// table row, so the json flush threw "Cannot use numerical key for object
// container" on this and every later keystroke, and no later edit was saved.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function clickEndOfCell(page: Page, text: string): Promise<void> {
    await page.locator('.mu-table-cell-content').filter({ hasText: new RegExp(`^${text}$`) }).click();
    await page.keyboard.press('End');
}

test.describe('forward Delete at the end of a table\'s last cell (#5386)', () => {
    test('keeps the second block after the table and saves later edits', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '| x | y |\n| - | - |\n| 1 | 2 |\n\np\n\nq\n');

        await clickEndOfCell(page, '2');
        await page.keyboard.press('Delete');
        await page.keyboard.type('z');
        await clickEndOfCell(page, 'x');
        await page.keyboard.type('w');

        await expect.poll(() => getMarkdown(page)).toBe('| xw  | y   |\n| --- | --- |\n| 1   | 2zp |\n\nq\n');
        expect(errors).toEqual([]);
    });

    test('in a list, keeps the merged item\'s sublist outside the table', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n\n  | x | y |\n  | - | - |\n  | 1 | 2 |\n- b\n  - c\n');

        await clickEndOfCell(page, '2');
        await page.keyboard.press('Delete');
        await page.keyboard.type('z');

        await expect.poll(() => getMarkdown(page)).toBe('- a\n\n  | x   | y   |\n  | --- | --- |\n  | 1   | 2zb |\n\n  - c\n');
        expect(errors).toEqual([]);
    });
});
