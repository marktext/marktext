import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * #4894 — table columns size to their content, like GitHub. A blanket
 * `min-width: 10em` on every cell content inflated each column's minimum to
 * ~160px: narrow columns (`#`, `Short`) wasted space while a long column was
 * squashed into the remainder, so every table read as a rough equal split
 * regardless of content. The floor is now 2em — just enough that an empty
 * cell keeps a visible, clickable caret slot.
 */

const REPRO_MD = [
    '| # | Short | Content |',
    '| --- | --- | --- |',
    '| 1 | Ok | A pretty long amount of content that should force this column '
    + 'to render much wider than the first. Though in reality most of my '
    + 'long-column\'s content will be squished in a narrow space. |',
    '',
].join('\n');

test('columns follow their content width instead of an equal split (#4894)', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), REPRO_MD);
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();

    const widths = await table
        .locator('tr')
        .first()
        .locator('td')
        .evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));

    expect(widths).toHaveLength(3);
    const [hash, short, content] = widths;
    // The narrow columns hug their content — well under the ~186px the old
    // 10em floor rendered them at…
    expect(hash).toBeLessThan(100);
    expect(short).toBeLessThan(120);
    // …and the long column takes the bulk of the table.
    expect(content).toBeGreaterThan((hash + short) * 2);
});

test('an empty cell still offers a usable caret slot', async ({ page }) => {
    await page.evaluate(
        md => window.muya!.setContent(md),
        '|  |  |\n| --- | --- |\n|  |  |\n',
    );
    const firstCell = page.locator(editor.table).first().locator('td').first();
    await expect(firstCell).toBeVisible();

    // The 2em floor plus cell padding keeps the empty cell a real click
    // target rather than a zero-width sliver.
    const { width } = (await firstCell.boundingBox())!;
    expect(width).toBeGreaterThanOrEqual(40);

    await firstCell.click();
    await page.keyboard.type('hi');
    await expect(firstCell).toContainText('hi');
});
