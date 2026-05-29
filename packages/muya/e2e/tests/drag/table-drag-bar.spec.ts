import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * TableDragBar end-to-end coverage.
 *
 * The bar is NOT a column-resize tool — it's a column / row REORDER tool
 * (see `packages/core/src/ui/tableDragBar/index.ts::switchTableData`).
 * On mousedown + a 300 ms hold, `startDrag` arms; mousemove past the
 * 5 px threshold flips `_isDragTableBar` true; mouseup commits the
 * reorder by splicing `tableState.children` and replacing the table
 * node. So the contract we assert: after a horizontal drag of the
 * leftmost column past the next column's midpoint, `getMarkdown()`
 * returns the columns in swapped order.
 *
 * Phase 2 BACKLOG note "assert column meta width changed" was based on
 * a misreading of the source — table cells have `meta.align`, never a
 * width. Reordering is the only state mutation this UI produces, so
 * that's what we cover here.
 */

async function makeTwoColumnTable(page: import('@playwright/test').Page) {
    await page.evaluate(() => window.muya!.setContent(''));
    await page.locator(editor.paragraph).first().click();
    await page.keyboard.type('| col-a | col-b |');
    await page.keyboard.press('Enter');
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();
    return table;
}

/**
 * Variant that seeds body cell contents directly via `setContent`. Typing
 * across cells through Tab / re-click is flaky under high-parallel
 * matrices because each keystroke re-renders the cell DOM and the next
 * click can race the patch. Driving through setContent skips that path
 * entirely — we still cover the keyboard-creation flow via the dedicated
 * spec in `tests/typing/table.spec.ts`.
 */
async function makeTableWithBody(
    page: import('@playwright/test').Page,
    headers: [string, string],
    body: [string, string],
) {
    await page.evaluate(({ h, b }) => {
        const md = `| ${h[0]} | ${h[1]} |\n| --- | --- |\n| ${b[0]} | ${b[1]} |\n`;
        window.muya!.setContent(md);
    }, { h: headers, b: body });
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();
    return table;
}

test.describe('TableDragBar column reorder', () => {
    test('drag bar appears when hovering just below the table', async ({ page }) => {
        const table = await makeTwoColumnTable(page);

        // The bar's mousemove handler shows the bar when:
        //   !hasTableCell(elsAtCursor) && hasTableCell(elsAt(y - 20))
        // So the cursor needs to be OUTSIDE the table (no cell at the
        // current point) but just below it so `y - 20` lands inside the
        // body row's cell. Probe a few pixels below the last row.
        const lastRowCell = table.locator('tr').last().locator('td').first();
        const box = await lastRowCell.boundingBox();
        if (!box)
            throw new Error('header cell has no bounding box');

        const probeX = box.x + box.width / 2;
        const probeY = box.y + box.height + 10;
        await page.mouse.move(probeX, probeY);
        await page.waitForTimeout(80);
        await page.mouse.move(probeX, probeY + 1);
        // The bar is a baseFloat — its wrapper (`.mu-float-wrapper`) is
        // parked at opacity:0 + left/top:-9999px until shown. `toBeVisible()`
        // reads "hidden" because the wrapper has display:flex but opacity:0;
        // poll the wrapper's opacity instead (CLAUDE.md convention).
        const dragBar = page.locator(floats.tableDragBar);
        await expect.poll(async () => dragBar.evaluate((el) => {
            const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
            if (!wrapper)
                return 0;
            return Number.parseFloat(wrapper.style.opacity || '0');
        }), { timeout: 5_000, intervals: [50, 100, 250, 500] }).toBeGreaterThan(0);
    });

    test('dragging the first column past the second swaps column order in markdown', async ({ page }) => {
        const table = await makeTableWithBody(page, ['col-a', 'col-b'], ['A', 'B']);

        const beforeMd = await getMarkdown(page);
        expect(beforeMd).toMatch(/\|\s*col-a\s*\|\s*col-b\s*\|/);
        expect(beforeMd).toMatch(/\|\s*A\s*\|\s*B\s*\|/);

        // Hover just BELOW the table so the bar appears under the bottom
        // edge of the first column. The mousemove handler triggers when
        // the cursor is OUT of every cell but `(x, y - 20)` lands inside
        // a cell — so the probe Y is `tableBottom + 10`.
        const firstColLastRow = table.locator('tr').last().locator('td').first();
        const secondColLastRow = table.locator('tr').last().locator('td').nth(1);
        const firstBox = await firstColLastRow.boundingBox();
        const secondBox = await secondColLastRow.boundingBox();
        if (!firstBox || !secondBox)
            throw new Error('last-row cells have no bounding box');

        const firstCx = firstBox.x + firstBox.width / 2;
        const secondCx = secondBox.x + secondBox.width / 2;
        const probeY = firstBox.y + firstBox.height + 10;

        await page.mouse.move(firstCx, probeY);
        await page.waitForTimeout(80);
        await page.mouse.move(firstCx, probeY + 1);

        const dragBar = page.locator(floats.tableDragBar);
        await expect.poll(async () => dragBar.evaluate((el) => {
            const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
            if (!wrapper)
                return 0;
            return Number.parseFloat(wrapper.style.opacity || '0');
        }), { timeout: 5_000, intervals: [50, 100, 250, 500] }).toBeGreaterThan(0);

        // Position the cursor over the drag bar itself, then mousedown +
        // hold for >300 ms (TableDragBar.mousedown wraps startDrag in a
        // setTimeout(_, 300) — the timer is what arms the drag).
        const barBox = await dragBar.boundingBox();
        if (!barBox)
            throw new Error('drag bar has no bounding box');
        const barCx = barBox.x + barBox.width / 2;
        const barCy = barBox.y + barBox.height / 2;
        await page.mouse.move(barCx, barCy);
        await page.mouse.down();
        // Hold past the 300 ms arming threshold.
        await page.waitForTimeout(400);

        // Now drag horizontally PAST the second column's midpoint. The bar's
        // calculateCurIndex compares the cumulative aspect deltas against
        // the current offset, so we overshoot a touch to be safe across
        // engines.
        const dragTargetX = secondCx + secondBox.width / 2 + 10;
        // A couple of intermediate move steps help the throttled handler
        // observe the displacement on every engine.
        await page.mouse.move((barCx + dragTargetX) / 2, barCy, { steps: 5 });
        await page.mouse.move(dragTargetX, barCy, { steps: 5 });
        await page.mouse.up();

        // switchTableData runs from a setTimeout(_, 300) at the end of
        // docMouseup, so poll on the markdown rather than reading once.
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/\|\s*col-b\s*\|\s*col-a\s*\|/);

        const afterMd = await getMarkdown(page);
        expect(afterMd).toMatch(/\|\s*B\s*\|\s*A\s*\|/);
    });
});
