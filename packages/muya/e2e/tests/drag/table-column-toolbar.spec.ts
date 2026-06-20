import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * TableColumnToolbar (the `.mu-table-column-tools` per-column alignment +
 * insert/remove popup) end-to-end coverage.
 *
 * Trigger contract (source of truth:
 * `packages/muya/src/ui/tableColumnToolbar/index.ts`):
 *   - A throttled (300ms) `mousemove` handler shows the toolbar when the
 *     cursor sits OUTSIDE every cell but `elementsFromPoint(x, y + 27)`
 *     lands inside a `table.cell` — i.e. hovering just ABOVE a column.
 *     `_block` becomes that cell; `show(cell)` reveals the float.
 *   - The toolbar renders six icons (config.ts order): align left / center
 *     / right, insert column left / right, remove column.
 *   - Clicking an align icon calls `table.alignColumn(offset, type)`, which
 *     toggles every cell in that column between the requested alignment and
 *     'none' (writing `data-align` + `meta.align` + an OT op).
 *   - Item 92: the handler bails to `this.hide()` when the inline format
 *     toolbar (`mu-format-picker`) is currently shown, so the column tools
 *     never sit on top of the format picker.
 *
 * The engine `alignColumn` toggle is unit-tested in
 * `src/block/gfm/table/__tests__/alignColumn.spec.ts`; THIS spec pins the
 * hover-reveal + icon-click wiring + format-picker suppression that no test
 * exercised.
 */

const THREE_COLUMN_TABLE = '| head one | head two | head three |\n| --- | --- | --- |\n| alpha | bravo | charlie |\n';

async function makeThreeColumnTable(page: Page) {
    await page.evaluate((md) => {
        window.muya!.setContent(md);
    }, THREE_COLUMN_TABLE);
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();
    // Header row + one body row.
    await expect(table.locator('tr')).toHaveCount(2);
    return table;
}

/** Read a parked baseFloat wrapper's opacity (>0 === shown). */
async function wrapperOpacity(page: Page, selector: string): Promise<number> {
    return page.locator(selector).first().evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        if (!wrapper)
            return 0;
        return Number.parseFloat(wrapper.style.opacity || '0');
    });
}

async function expectShown(page: Page, selector: string) {
    await expect.poll(async () => wrapperOpacity(page, selector), {
        timeout: 5_000,
        intervals: [50, 100, 250, 500],
    }).toBeGreaterThan(0);
}

/**
 * Hover just ABOVE the header cell at `column` so the column toolbar's
 * handler picks it up: the cursor is in no cell, but `(x, y + 27)` lands
 * inside the header cell. Probe ~10px above the cell's top edge.
 */
async function revealColumnToolbar(
    page: Page,
    table: ReturnType<Page['locator']>,
    column: number,
) {
    const headerCell = table.locator('tr').first().locator('th, td').nth(column);
    const box = await headerCell.boundingBox();
    if (!box)
        throw new Error('header cell has no bounding box');

    const probeX = box.x + box.width / 2;
    const probeY = box.y - 10;
    await page.mouse.move(probeX, probeY);
    await page.waitForTimeout(80);
    await page.mouse.move(probeX, probeY + 1);

    await expectShown(page, floats.tableColumnTools);
    return page.locator(floats.tableColumnTools).first();
}

/** Every `data-align` value down the given column (header + body cells). */
async function columnAligns(
    table: ReturnType<Page['locator']>,
    column: number,
): Promise<string[]> {
    return table.locator('tr').evaluateAll((rows, col) => {
        return rows.map((row) => {
            const cell = row.querySelectorAll('th, td')[col] as HTMLElement | undefined;
            return cell?.dataset.align ?? '';
        });
    }, column);
}

test.describe('TableColumnToolbar (per-column alignment popup)', () => {
    test('the toolbar appears when hovering just above a column', async ({ page }) => {
        const table = await makeThreeColumnTable(page);
        // Parked before the hover.
        expect(await wrapperOpacity(page, floats.tableColumnTools)).toBe(0);

        await revealColumnToolbar(page, table, 0);
    });

    test('the toolbar renders six column-operation icons', async ({ page }) => {
        const table = await makeThreeColumnTable(page);
        const toolbar = await revealColumnToolbar(page, table, 0);

        // config.ts order: left / center / right align + insert-left /
        // insert-right + remove. The align items render as `item left` etc.
        // while the insert items share the `left` / `right` tokens
        // (`item insert left`), so scope the align assertions with
        // `:not(.insert)` to disambiguate.
        const items = toolbar.locator('li.item');
        await expect(items).toHaveCount(6);
        await expect(toolbar.locator('li.item.left:not(.insert)')).toHaveCount(1);
        await expect(toolbar.locator('li.item.center')).toHaveCount(1);
        await expect(toolbar.locator('li.item.right:not(.insert)')).toHaveCount(1);
        await expect(toolbar.locator('li.item.insert.left')).toHaveCount(1);
        await expect(toolbar.locator('li.item.insert.right')).toHaveCount(1);
        await expect(toolbar.locator('li.item.remove')).toHaveCount(1);
    });

    test('clicking center-align aligns the whole column and writes :---: in markdown', async ({ page }) => {
        const table = await makeThreeColumnTable(page);
        const toolbar = await revealColumnToolbar(page, table, 0);

        // Plain table parses every column as 'none'.
        expect(await columnAligns(table, 0)).toEqual(['none', 'none']);

        await toolbar.locator('li.item.center').click();

        // Every cell in column 0 (header + body) flips to center.
        await expect
            .poll(async () => columnAligns(table, 0))
            .toEqual(['center', 'center']);
        // The serialized delimiter row carries the center marker (`:---:`,
        // dash count padded to the column width).
        await expect.poll(async () => getMarkdown(page)).toMatch(/:-+:/);

        // Sibling columns are untouched.
        expect(await columnAligns(table, 1)).toEqual(['none', 'none']);
    });

    test('clicking center-align again toggles the column back to none', async ({ page }) => {
        const table = await makeThreeColumnTable(page);
        let toolbar = await revealColumnToolbar(page, table, 0);

        // First click: center.
        await toolbar.locator('li.item.center').click();
        await expect
            .poll(async () => columnAligns(table, 0))
            .toEqual(['center', 'center']);
        await expect.poll(async () => getMarkdown(page)).toMatch(/:-+:/);

        // selectItem re-renders the same toolbar in place; move away then
        // re-hover so the throttled handler re-targets the column cleanly.
        await page.mouse.move(5, 5);
        await page.waitForTimeout(80);
        toolbar = await revealColumnToolbar(page, table, 0);

        // Second click with the same alignment toggles back to none.
        await toolbar.locator('li.item.center').click();
        await expect
            .poll(async () => columnAligns(table, 0))
            .toEqual(['none', 'none']);
        // The center marker is gone; a bare dashes delimiter remains.
        await expect.poll(async () => getMarkdown(page)).not.toMatch(/:-+:/);
        expect(await getMarkdown(page)).toMatch(/-{3,}/);
    });

    test('the toolbar hides when the inline format picker is opened over a cell', async ({ page }) => {
        const table = await makeThreeColumnTable(page);
        const toolbar = await revealColumnToolbar(page, table, 0);
        await expect(toolbar).toBeVisible();

        // Drag-select the body-cell text to open the inline format toolbar
        // (`muya-format-picker` fires on a non-collapsed selection in a
        // Format leaf — see block/base/format.ts; the table cell content is a
        // Format leaf). A dblclick re-anchors the caret to a collapsed
        // selection in this engine, so drive a real mouse drag instead.
        const cellContent = table
            .locator('tr')
            .last()
            .locator('td, th')
            .first()
            .locator('.mu-table-cell-content')
            .first();
        const contentBox = await cellContent.boundingBox();
        if (!contentBox)
            throw new Error('cell content has no bounding box');
        await page.mouse.move(contentBox.x + 2, contentBox.y + contentBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            contentBox.x + contentBox.width - 2,
            contentBox.y + contentBox.height / 2,
            { steps: 6 },
        );
        await page.mouse.up();
        await expectShown(page, floats.inlineFormatToolbar);

        // The column toolbar's handler bails to hide() while the format
        // picker is shown — nudge the mouse back into the hover region so
        // the throttled handler re-evaluates and suppresses the toolbar.
        const headerCell = table.locator('tr').first().locator('th, td').first();
        const box = await headerCell.boundingBox();
        if (!box)
            throw new Error('header cell has no bounding box');
        const probeX = box.x + box.width / 2;
        const probeY = box.y - 10;
        await page.mouse.move(probeX, probeY);
        await page.waitForTimeout(80);
        await page.mouse.move(probeX, probeY + 1);

        await expect
            .poll(async () => wrapperOpacity(page, floats.tableColumnTools), {
                timeout: 5_000,
                intervals: [50, 100, 250, 500],
            })
            .toBe(0);
    });
});
