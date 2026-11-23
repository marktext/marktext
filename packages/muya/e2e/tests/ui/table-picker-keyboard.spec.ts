import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { floats } from '../helpers/selectors';

// The `/table` picker opens with its row input focused, so a table can be
// inserted from the keyboard: rows, Tab, columns, Enter.

async function openPickerWithSlashCommand(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent([{ name: 'paragraph', text: '' }]));
    await page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true));
    await slowType(page, '/table');
    await expect(page.locator(floats.quickInsert)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${floats.tablePicker} input.row-input`)).toBeFocused();
}

test.describe('table picker keyboard input', () => {
    test('rows, Tab, columns, Enter inserts the table', async ({ page }) => {
        await openPickerWithSlashCommand(page);

        await page.keyboard.type('3');
        await page.keyboard.press('Tab');
        await page.keyboard.type('2');
        await page.keyboard.press('Enter');

        await expect.poll(() => getMarkdown(page)).toBe('|     |     |\n| --- | --- |\n|     |     |\n|     |     |\n');
        await page.keyboard.type('A');
        await expect.poll(() => getMarkdown(page)).toContain('| A   |');
    });

    test('Escape closes the picker and returns to the text', async ({ page }) => {
        await openPickerWithSlashCommand(page);

        await page.keyboard.press('Escape');
        await page.keyboard.type('x');

        await expect.poll(() => getMarkdown(page)).toBe('/tablex\n');
    });
});
