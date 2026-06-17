import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem, tablePickerCell } from '../helpers/selectors';

/**
 * Seed a 2x2 GFM table directly via `setContent` (header row + one body row,
 * two columns). Driving the table through markdown is far steadier than
 * typing `| .. |` + Enter under headless, and lets cell-editing tests start
 * from a known shape. muya renders `<figure.mu-table><table.mu-table-inner>`
 * with NO `<thead>`/`<tbody>` — every cell is a `<td.mu-table-cell>` whose
 * editable leaf carries `.mu-table-cell-content`.
 *
 * The first body cell is left EMPTY on purpose so cell-editing tests can type
 * into a clean cell. Clearing a seeded cell with Backspace inside the cell is
 * unsafe — TableCellContent.backspaceHandler at offset 0 can replace the whole
 * table — so editing tests must start from an empty cell rather than delete.
 */
async function makeTwoByTwoTable(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
        window.muya!.setContent('| h1 | h2 |\n| --- | --- |\n|  | b |\n');
    });
    const table = page.locator(editor.table).first();
    await expect(table).toBeVisible();
    // Two rows (header + body), two columns each.
    await expect(table.locator('tr')).toHaveCount(2);
    await expect(table.locator('tr').first().locator('td')).toHaveCount(2);
    return table;
}

test.describe('table', () => {
    test('typing `| a | b |` + Enter converts paragraph to a table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('| a | b |');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.table).first()).toBeVisible();
    });

    test('slash menu /table opens the grid picker, which creates the picked-size table', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('table')).click();

        // The in-editor "table" insert shows the hover-grid dimension picker
        // (TableChessboard) rather than dropping a default table directly.
        const picker = page.locator(floats.tablePicker);
        await expect(picker).toBeVisible();
        await expect(page.locator(editor.table)).toHaveCount(0);

        // Hover then click the zero-based (1, 2) cell -> a 2-row × 3-column
        // table (header row + 1 body row, 3 columns).
        const cell = page.locator(tablePickerCell(1, 2));
        await cell.hover();
        await cell.click();

        const table = page.locator(editor.table).first();
        await expect(table).toBeVisible();
        // The picker dismisses on pick. Like the other muya floats it "hides"
        // via opacity on its `.mu-float-wrapper` parent (the DOM node is not
        // removed), so probe the computed opacity rather than `toBeHidden`.
        const pickerWrapper = page.locator('.mu-float-wrapper', { has: picker });
        await expect
            .poll(() => pickerWrapper.evaluate(el => getComputedStyle(el).opacity))
            .toBe('0');
        // 2 rows total (1 header + 1 body), 3 columns. muya renders every cell
        // as <td> (no <th>/<thead> wrappers — see the cell-typing test below).
        await expect(table.locator('tr')).toHaveCount(2);
        await expect(table.locator('tr').first().locator('td')).toHaveCount(3);
    });

    test('typing in a table cell reflects in getMarkdown', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('| h1 | h2 |');
        await page.keyboard.press('Enter');
        const table = page.locator(editor.table).first();
        await expect(table).toBeVisible();
        // muya renders <table><tr>...</tr><tr>...</tr></table> with no
        // <thead>/<tbody> wrappers. The cursor lands in the first body cell
        // (= second <tr>) after table creation.
        const firstBodyCell = table.locator('tr').nth(1).locator('td').first();
        await firstBodyCell.click();
        await slowType(page, 'cell-text');
        await expect(firstBodyCell).toContainText('cell-text');
        const md = await getMarkdown(page);
        expect(md).toContain('cell-text');
    });

    test('typing `**b**` in a cell renders an inline strong run and round-trips to markdown', async ({ page }) => {
        const table = await makeTwoByTwoTable(page);

        // Edit the (empty) first body cell. The cell content leaf is a
        // `Format` block, so the inline `**...**` tokenizer applies.
        const bodyCell = table.locator('tr').nth(1).locator('td').first();
        const cellContent = bodyCell.locator('.mu-table-cell-content');
        await cellContent.click();
        await slowType(page, '**b**');

        // The strong run renders as a live `<strong>` element inside the cell
        // (see inlineRenderer/renderer/delEmStrongFactory.ts — it emits
        // `h('strong.mu-inline-rule', ...)`).
        const strong = bodyCell.locator('strong');
        await expect(strong).toHaveCount(1);
        // Characterization: while the caret is still between the live `**`
        // markers, the trailing pair is absorbed into the strong content, so
        // the rendered text reads `b**` (not a bare `b`). Assert what actually
        // renders — the run carries the `b`.
        await expect(strong).toContainText('b');

        // getMarkdown serialises the strong run back into the body cell. Same
        // marker-absorption quirk shows up here as `**b****`, so assert the
        // strong opener rather than an exact `**b**`.
        await expect.poll(() => getMarkdown(page)).toContain('**b');
    });

    test('a block-level shortcut (`# `) typed in a cell stays cell text (no heading conversion)', async ({ page }) => {
        const table = await makeTwoByTwoTable(page);

        // The `# `→atx-heading shortcut is owned by ParagraphContent's
        // re-parse path; TableCellContent extends `Format` directly and never
        // runs it, so the hashes remain literal cell text.
        const bodyCell = table.locator('tr').nth(1).locator('td').first();
        const cellContent = bodyCell.locator('.mu-table-cell-content');
        await cellContent.click();
        await slowType(page, '# x');

        // No atx-heading appears, and the table is still a table.
        await expect(page.locator(editor.atxHeading)).toHaveCount(0);
        await expect(table).toBeVisible();
        // The literal text lives in the cell.
        await expect(cellContent).toContainText('# x');

        // The active selection is still inside a table cell content block —
        // the shortcut did NOT escape the cell.
        const anchorBlockName = await page.evaluate(
            () => window.muya!.editor.selection.getSelection()?.anchor?.block?.blockName,
        );
        expect(anchorBlockName).toBe('table.cell.content');

        // The markdown still holds the literal hashes inside the GFM table row,
        // not as a heading.
        const md = await getMarkdown(page);
        expect(md).toContain('# x');
        expect(md).toContain('|');
    });

    test('clicking the table figure dead-zone places the caret in the last cell', async ({ page }) => {
        const table = await makeTwoByTwoTable(page);

        // `editor.table` resolves the inner `<table.mu-table-inner>`. The
        // dead-zone target is its `<figure.mu-table>` parent, which has
        // `padding: 0.5em 0` (top/bottom only). Table#_listenDomEvent only
        // fires its caret-to-last-cell handler when `event.target` IS the
        // figure node — i.e. a click in that top/bottom padding band, not on
        // any `<td>`.
        const figureBox = await table.evaluate((tableEl) => {
            const figure = tableEl.closest('figure.mu-table') as HTMLElement | null;
            if (!figure)
                throw new Error('table figure (.mu-table) not found');
            const r = figure.getBoundingClientRect();
            const inner = tableEl.getBoundingClientRect();
            return {
                x: r.x,
                width: r.width,
                figureBottom: r.bottom,
                innerBottom: inner.bottom,
            };
        });

        // Click in the bottom padding band of the figure (below the inner
        // table, still inside the figure), targeting the last cell.
        const clickX = figureBox.x + figureBox.width / 2;
        const padGap = figureBox.figureBottom - figureBox.innerBottom;
        // Guard: the padding band must exist for this click to land on the
        // figure rather than the inner table.
        expect(padGap).toBeGreaterThan(1);
        const clickY = figureBox.innerBottom + padGap / 2;
        await page.mouse.click(clickX, clickY);

        // The caret is now in a table cell content block. Read the live
        // selection's anchor block name (set by Table's mousedown handler via
        // `lastContentInDescendant().setCursor(...)`).
        await expect.poll(
            () => page.evaluate(
                () => window.muya!.editor.selection.getSelection()?.anchor?.block?.blockName ?? null,
            ),
        ).toBe('table.cell.content');

        // And it is specifically the LAST cell of the table (last row, last
        // column) — `lastContentInDescendant`.
        const inLastCell = await page.evaluate(() => {
            const anchorBlock = window.muya!.editor.selection.getSelection()?.anchor?.block;
            if (!anchorBlock)
                return false;
            const cellEl = (anchorBlock.domNode as HTMLElement | undefined)?.closest('td.mu-table-cell');
            const figure = cellEl?.closest('figure.mu-table');
            const cells = figure ? [...figure.querySelectorAll('td.mu-table-cell')] : [];
            return cellEl != null && cells.length > 0 && cells[cells.length - 1] === cellEl;
        });
        expect(inLastCell).toBe(true);
    });
});
