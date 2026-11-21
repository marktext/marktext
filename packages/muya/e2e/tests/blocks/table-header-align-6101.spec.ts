import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * #6101 — a column without an alignment marker exports its header as a bare
 * `<th>`, which HTML/PDF exports (and GitHub) center. The editor forced every
 * unaligned cell to the left, so the live header disagreed with the export.
 */

const REPRO_MD = [
    '| unaligned | centered | right | left |',
    '| --- | :---: | ---: | :--- |',
    '| 1 | X | 1 | A |',
    '',
].join('\n');

function textAligns(row: Locator) {
    return row
        .locator('td')
        .evaluateAll(cells => cells.map(cell => getComputedStyle(cell).textAlign));
}

test('unaligned header cells are centered like the export (#6101)', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), REPRO_MD);
    const rows = page.locator(editor.table).first().locator('tr');
    await expect(rows).toHaveCount(2);

    expect(await textAligns(rows.nth(0))).toEqual(['center', 'center', 'right', 'left']);
    expect(await textAligns(rows.nth(1))).toEqual(['left', 'center', 'right', 'left']);
});
