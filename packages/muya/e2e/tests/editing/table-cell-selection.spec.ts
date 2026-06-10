import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

/**
 * Cross-cell table selection (Phase G restoration of the legacy
 * `tableSelectCellsCtrl`). Dragging a rectangle of cells highlights them
 * (`.mu-table-cell-selected`) and makes copy/cut operate on just that
 * sub-range: copy yields a sub-table's markdown, cut empties those cells.
 *
 * The drag and clipboard round-trip need a real pointer + real OS clipboard,
 * so this runs on bundled Chromium only (same constraint as
 * `editing/clipboard.spec.ts`); Firefox/WebKit headless clipboard is tracked
 * in BACKLOG Phase 3.
 */

const TABLE_MD = [
    '| a1 | b1 | c1 |',
    '| --- | --- | --- |',
    '| a2 | b2 | c2 |',
    '| a3 | b3 | c3 |',
    '',
].join('\n');

async function seedTable(page: Page): Promise<void> {
    await page.evaluate(md => window.muya!.setContent(md), TABLE_MD);
    await expect(page.locator(editor.table).first()).toBeVisible();
}

// Centre point of the cell at (row, column), both zero-based, for page.mouse.
async function cellCenter(page: Page, row: number, column: number) {
    const cell = page.locator(editor.table).first()
        .locator('tr').nth(row)
        .locator('td').nth(column);
    const box = await cell.boundingBox();
    if (!box)
        throw new Error(`cell (${row}, ${column}) has no bounding box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragSelect(
    page: Page,
    from: { row: number; column: number },
    to: { row: number; column: number },
): Promise<void> {
    const start = await cellCenter(page, from.row, from.column);
    const end = await cellCenter(page, to.row, to.column);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Intermediate steps so the move handler sees the displacement and arms.
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
}

function selectedCount(page: Page) {
    return page.locator(`${editor.table} td.mu-table-cell-selected`).count();
}

test.describe('cross-cell table selection', () => {
    test('dragging across cells highlights the rectangle', async ({ page }) => {
        await seedTable(page);
        await dragSelect(page, { row: 0, column: 0 }, { row: 1, column: 1 });

        await expect.poll(() => selectedCount(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe(4);
    });

    test('copy yields only the selected sub-rectangle as a GFM table', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'clipboard read unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await seedTable(page);

        await dragSelect(page, { row: 0, column: 0 }, { row: 1, column: 1 });
        await expect.poll(() => selectedCount(page)).toBe(4);

        await page.keyboard.press(`${metaKey()}+c`);

        const copied = await page.evaluate(() => navigator.clipboard.readText());
        // a1/b1 + a2/b2 only — the un-selected column/row are excluded.
        expect(copied).toContain('a1');
        expect(copied).toContain('b2');
        expect(copied).not.toContain('c1');
        expect(copied).not.toContain('a3');
        // It is a real GFM table (header separator row).
        expect(copied).toMatch(/\|\s*-+/);
    });

    test('cut empties only the selected cells', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'clipboard unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await seedTable(page);

        await dragSelect(page, { row: 0, column: 0 }, { row: 1, column: 1 });
        await expect.poll(() => selectedCount(page)).toBe(4);

        await page.keyboard.press(`${metaKey()}+x`);

        await expect.poll(() => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).not.toMatch(/\ba1\b/);

        const md = await getMarkdown(page);
        expect(md).not.toMatch(/\bb2\b/); // selected cells cleared
        expect(md).toContain('c1'); // un-selected survive
        expect(md).toContain('a3');
    });
});
