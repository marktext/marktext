import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * #5574 — the column toolbar re-anchored itself to whichever column sat under
 * the cursor. The toolbar is 160px wide, so over a narrow column it overhangs
 * into the neighbour: moving the pointer onto the toolbar (e.g. toward the
 * right-most "remove column" icon) re-resolved the anchor to that neighbour
 * and the toolbar jumped sideways out from under the cursor, making the menu
 * almost impossible to click.
 *
 * Source of truth: `packages/muya/src/ui/tableColumnToolbar/index.ts` — the
 * throttled `mousemove` handler derived `_block` from
 * `elementsFromPoint(x, y + OFFSET)`. The fix keeps the current anchor while
 * the pointer is over the toolbar itself.
 */

// Short cells => ~58px columns, so the 160px toolbar spans a neighbour.
const SIX_COLUMN_TABLE
    = '| c0 | c1 | c2 | c3 | c4 | c5 |\n| --- | --- | --- | --- | --- | --- |\n| v0 | v1 | v2 | v3 | v4 | v5 |\n';

async function wrapperOpacity(page: Page, selector: string): Promise<number> {
    return page.locator(selector).first().evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        if (!wrapper)
            return 0;
        return Number.parseFloat(wrapper.style.opacity || '0');
    });
}

test('#5574 the column toolbar stays anchored while the pointer is on it', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), SIX_COLUMN_TABLE);
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();

    // Hover just above the third column so the toolbar opens over it.
    const headerCell = table.locator('tr').first().locator('th, td').nth(2);
    const cellBox = (await headerCell.boundingBox())!;
    const probeX = cellBox.x + cellBox.width / 2;
    const probeY = cellBox.y - 10;
    await page.mouse.move(probeX, probeY);
    await page.waitForTimeout(80);
    await page.mouse.move(probeX, probeY + 1);

    await expect
        .poll(() => wrapperOpacity(page, floats.tableColumnTools), { timeout: 5_000 })
        .toBeGreaterThan(0);

    const toolbar = page.locator(floats.tableColumnTools).first();
    const before = (await toolbar.boundingBox())!;

    // Aim at the right-most icon; its centre sits over the next column.
    const removeBox = (await toolbar.locator('li.item.remove').boundingBox())!;
    const targetX = removeBox.x + removeBox.width / 2;
    const targetY = removeBox.y + removeBox.height / 2;
    await page.mouse.move(targetX, targetY);
    // Let the 300ms-throttled handler re-evaluate.
    await page.waitForTimeout(600);

    // The toolbar must not have jumped to the neighbouring column...
    const after = (await toolbar.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(5);

    // ...so the icon the user aimed at is still under the pointer...
    const overRemoveIcon = await page.evaluate(({ x, y }) => {
        return document.elementFromPoint(x, y)?.closest('li.item.remove') != null;
    }, { x: targetX, y: targetY });
    expect(overRemoveIcon).toBe(true);

    // ...and clicking it removes the column the toolbar was opened on.
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => getMarkdown(page)).not.toContain('c2');
});
