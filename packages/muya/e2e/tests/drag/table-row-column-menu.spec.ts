import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

/**
 * TableRowColumMenu (the `.mu-table-bar-tools` row/column operations popup)
 * end-to-end coverage.
 *
 * Trigger contract (source of truth:
 * `packages/core/src/ui/tableDragBar/index.ts`):
 *   - Hovering just OUTSIDE the table — so the cursor sits in no cell but a
 *     cell exists 20px above OR 20px to the left — reveals the drag bar.
 *     `barType` is 'bottom' when a cell is 20px above (cursor below the
 *     table) and 'right' when a cell is 20px to the left (cursor right of
 *     the table).
 *   - A QUICK click on the bar (mousedown + mouseup inside the 300ms drag
 *     arming window) clears the drag timer. ONLY when `barType === 'right'`
 *     does `mouseup` emit `muya-table-bar`, which shows the
 *     `TableRowColumMenu`. A quick click on the BOTTOM bar emits nothing —
 *     no menu opens (the column equivalent is wired through
 *     `TableColumnToolbar`, not this popup).
 *
 * The 'right' menu renders Insert Row Above / Insert Row Below / Remove Row
 * (`packages/core/src/ui/tableRowColumMenu/config.ts::toolList.right`).
 */

const TWO_BY_TWO = '| h1 | h2 |\n| --- | --- |\n| a | b |\n';

async function makeTwoByTwo(page: Page) {
    await page.evaluate((md) => {
        window.muya!.setContent(md);
    }, TWO_BY_TWO);
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();
    // Two rows: the header row + one body row.
    await expect(table.locator('tr')).toHaveCount(2);
    return table;
}

/** Read the float wrapper's opacity for a parked baseFloat (>0 === shown). */
async function wrapperOpacity(page: Page, selector: string): Promise<number> {
    // `.mu-table-bar-tools` lands on BOTH the float wrapper and the inner
    // container (the TableRowColumMenu constructor adds it to floatBox too),
    // so scope to the first match — both share the same `.mu-float-wrapper`.
    return page.locator(selector).first().evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        if (!wrapper)
            return 0;
        return Number.parseFloat(wrapper.style.opacity || '0');
    });
}

/** The TableRowColumMenu content container (avoids the wrapper double-match). */
function menuContainer(page: Page) {
    return page.locator(`.mu-float-container${floats.tableRowColumMenu}`);
}

async function expectShown(page: Page, selector: string) {
    await expect.poll(async () => wrapperOpacity(page, selector), {
        timeout: 5_000,
        intervals: [50, 100, 250, 500],
    }).toBeGreaterThan(0);
}

/**
 * Hover just to the RIGHT of the table's last body row so the drag bar's
 * mousemove handler picks `barType === 'right'`: the cursor is in no cell,
 * but `(x - 20, y)` lands inside the rightmost cell.
 */
async function revealRightBar(page: Page, table: ReturnType<Page['locator']>) {
    const lastRowLastCell = table.locator('tr').last().locator('td, th').last();
    const box = await lastRowLastCell.boundingBox();
    if (!box)
        throw new Error('last-row cell has no bounding box');

    const probeX = box.x + box.width + 10;
    const probeY = box.y + box.height / 2;
    await page.mouse.move(probeX, probeY);
    await page.waitForTimeout(80);
    await page.mouse.move(probeX, probeY + 1);

    await expectShown(page, floats.tableDragBar);
    return page.locator(floats.tableDragBar);
}

/**
 * Hover just BELOW the table's first column so the handler picks
 * `barType === 'bottom'`: the cursor is in no cell, but `(x, y - 20)`
 * lands inside a body cell.
 */
async function revealBottomBar(page: Page, table: ReturnType<Page['locator']>) {
    const firstColLastRow = table.locator('tr').last().locator('td, th').first();
    const box = await firstColLastRow.boundingBox();
    if (!box)
        throw new Error('last-row first cell has no bounding box');

    const probeX = box.x + box.width / 2;
    const probeY = box.y + box.height + 10;
    await page.mouse.move(probeX, probeY);
    await page.waitForTimeout(80);
    await page.mouse.move(probeX, probeY + 1);

    await expectShown(page, floats.tableDragBar);
    return page.locator(floats.tableDragBar);
}

/**
 * Quick-click (mousedown immediately followed by mouseup, well inside the
 * 300ms drag-arming window) on the bar's centre.
 */
async function quickClickBar(page: Page, bar: ReturnType<Page['locator']>) {
    const box = await bar.boundingBox();
    if (!box)
        throw new Error('drag bar has no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
}

test.describe('TableRowColumMenu (row/column bar popup)', () => {
    test('the drag bar appears with right-orientation when hovering to the right of the table', async ({ page }) => {
        const table = await makeTwoByTwo(page);
        const bar = await revealRightBar(page, table);

        // The render(barType) call writes `data-drag` onto the container.
        await expect.poll(async () => bar.getAttribute('data-drag'), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('right');
    });

    test('a quick-click on the RIGHT bar opens the row-operations menu', async ({ page }) => {
        const table = await makeTwoByTwo(page);
        const bar = await revealRightBar(page, table);
        await expect.poll(async () => bar.getAttribute('data-drag')).toBe('right');

        await quickClickBar(page, bar);

        const menu = menuContainer(page);
        await expectShown(page, floats.tableRowColumMenu);

        // The 'right' toolList renders exactly three row operations.
        const items = menu.locator('li.item');
        await expect(items).toHaveCount(3);
        await expect(menu).toContainText('Insert Row Above');
        await expect(menu).toContainText('Insert Row Below');
        await expect(menu).toContainText('Remove Row');
        // It is the ROW menu, not the column menu.
        await expect(menu).not.toContainText('Column');
    });

    test('a quick-click on the BOTTOM bar does NOT open the row/column menu', async ({ page }) => {
        const table = await makeTwoByTwo(page);
        const bar = await revealBottomBar(page, table);
        await expect.poll(async () => bar.getAttribute('data-drag'), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('bottom');

        // Sanity: the popup is parked (hidden) before we click.
        expect(await wrapperOpacity(page, floats.tableRowColumMenu)).toBe(0);

        await quickClickBar(page, bar);

        // `mouseup` emits `muya-table-bar` only for the 'right' bar, so the
        // bottom bar must leave the popup parked. Give the (absent) emit a
        // window to land, then assert it never showed.
        await page.waitForTimeout(400);
        expect(await wrapperOpacity(page, floats.tableRowColumMenu)).toBe(0);
    });

    test('Insert Row Below adds a body row to the table', async ({ page }) => {
        const table = await makeTwoByTwo(page);
        const bar = await revealRightBar(page, table);
        await expect.poll(async () => bar.getAttribute('data-drag')).toBe('right');

        await quickClickBar(page, bar);

        const menu = menuContainer(page);
        await expectShown(page, floats.tableRowColumMenu);

        // `data-label` on each item is the action verb ('insert' / 'remove'),
        // shared across the two insert rows; disambiguate by visible text.
        await menu.locator('li.item', { hasText: 'Insert Row Below' }).click();

        // Adding a row grows the table from 2 rows (header + 1 body) to 3.
        await expect(table.locator('tr')).toHaveCount(3);
        // The popup closes after selecting an item.
        await expect.poll(async () => wrapperOpacity(page, floats.tableRowColumMenu), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe(0);
    });
});
