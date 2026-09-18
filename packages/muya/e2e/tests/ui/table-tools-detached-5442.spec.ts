import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats, quickInsertItem, tablePickerCell } from '../helpers/selectors';

// #5442: both table floats remember the cell they were opened on. An Undo that
// removed the table left them on screen pointing at a detached cell, and any
// item then threw "Cannot destructure property 'path' of 'this.parent' as it is
// null" — the same shape as #5213 and #5355.

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function insertTableViaPicker(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent('Hello\n'));
    await page.locator(editor.paragraph).first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.locator(quickInsertItem('table')).click();
    await expect(page.locator(floats.tablePicker)).toBeVisible();
    const cell = page.locator(tablePickerCell(1, 1));
    await cell.hover();
    await cell.click();
    await expect(page.locator(editor.table).first()).toBeVisible();
    // Let History close its grouping window so one Undo removes the table.
    await page.waitForTimeout(1_200);
}

// The drag bar appears when the pointer sits just outside a cell; a click
// shorter than the 300ms drag threshold opens the row menu.
async function openRowMenu(page: Page): Promise<void> {
    const table = page.locator(editor.table).first();
    const tableBox = (await table.boundingBox())!;
    const rowBox = (await table.locator('tr').nth(1).boundingBox())!;
    const x = tableBox.x + tableBox.width + 8;
    const y = rowBox.y + rowBox.height / 2;
    await page.mouse.move(x - 100, y);
    await page.waitForTimeout(150);
    await page.mouse.move(x, y);
    await page.waitForTimeout(250);
    await page.mouse.move(x + 1, y);
    await expect(page.locator(floats.tableDragBar).first()).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator(floats.tableRowColumMenu).first()).toBeVisible();
}

async function openColumnToolbar(page: Page): Promise<void> {
    const cell = page.locator(editor.table).first().locator('tr').first().locator('th, td').first();
    const box = (await cell.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y - 60);
    await page.waitForTimeout(350);
    await page.mouse.move(x, box.y - 10);
    await page.waitForTimeout(400);
    await page.mouse.move(x + 1, box.y - 10);
    await expect(page.locator(floats.tableColumnTools).first()).toBeVisible();
}

// Once the table is gone the float keeps its stale position, which can sit
// outside the viewport, so dispatch the click the handler listens for rather
// than steering the mouse to it.
async function clickFloatItem(page: Page, selector: string, index: number): Promise<void> {
    await page.evaluate(({ selector, index }) => {
        const item = document.querySelectorAll(selector)[index] as HTMLElement | undefined;
        item?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, { selector, index });
    await page.waitForTimeout(150);
}

test.describe('table tools whose table left the document (#5442)', () => {
    test('every row menu item is inert once Undo removed the table', async ({ page }) => {
        const errors = collectErrors(page);
        await insertTableViaPicker(page);
        await openRowMenu(page);

        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n');

        const selector = `${floats.tableRowColumMenu} li.item`;
        const count = await page.locator(selector).count();
        expect(count).toBe(3);
        for (let i = 0; i < count; i++)
            await clickFloatItem(page, selector, i);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        expect(await getMarkdown(page)).toBe('Hello\n');
    });

    test('every column toolbar item is inert once Undo removed the table', async ({ page }) => {
        const errors = collectErrors(page);
        await insertTableViaPicker(page);
        await openColumnToolbar(page);

        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n');

        const selector = `${floats.tableColumnTools} li.item`;
        const count = await page.locator(selector).count();
        expect(count).toBe(6);
        for (let i = 0; i < count; i++)
            await clickFloatItem(page, selector, i);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        expect(await getMarkdown(page)).toBe('Hello\n');
    });

    test('the row menu still edits a table that is in the document', async ({ page }) => {
        const errors = collectErrors(page);
        await page.evaluate(() => window.muya!.setContent('| a | b |\n| --- | --- |\n| c | d |\n| e | f |\n'));
        await openRowMenu(page);

        await page.locator(`${floats.tableRowColumMenu} li.item`).nth(2).click();
        await expect.poll(() => getMarkdown(page)).toBe('| a   | b   |\n| --- | --- |\n| e   | f   |\n');
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });
});
