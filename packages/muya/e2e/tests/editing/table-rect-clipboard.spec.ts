import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

/**
 * Gate for PR5 (table rect selection exclusive of text selection). The frozen
 * table rectangle no longer plants a model-level text caret in the anchor
 * cell — focus stays on the editor root and the clipboard listeners moved to
 * `document` with an ownership guard. This spec proves a real Cmd/Ctrl+C still
 * fires copy (clipboard receives the GFM sub-table) and Cmd/Ctrl+X still fires
 * cut (the spanned cells are emptied) under that new arrangement, in real
 * Chromium.
 *
 * Firefox/WebKit headless clipboard read is unreliable (same constraint as
 * editing/clipboard.spec.ts); tracked in BACKLOG Phase 3.
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
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
}

function selectedCount(page: Page) {
    return page.locator(`${editor.table} td.mu-table-cell-selected`).count();
}

test.describe('table rect clipboard (root-focus exclusivity)', () => {
    test('a frozen rectangle leaves no text caret or native range behind', async ({ page }) => {
        await seedTable(page);
        await dragSelect(page, { row: 0, column: 0 }, { row: 1, column: 1 });
        await expect.poll(() => selectedCount(page)).toBe(4);

        const state = await page.evaluate(() => ({
            hasTableSelection: window.muya!.editor.selection.table.hasSelection,
            activeContentBlock: window.muya!.editor.activeContentBlock,
            // Focusing the contenteditable root plants a collapsed caret range;
            // what matters for exclusivity is that no *text* is selected, so the
            // native blue highlight is gone — the cell rectangle is the only
            // visible selection.
            nativeSelectionText: document.getSelection()?.toString() ?? '',
            activeIsEditorRoot: document.activeElement === window.muya!.domNode,
            editorHasFocus: window.muya!.domNode.contains(document.activeElement),
        }));

        expect(state.hasTableSelection).toBe(true);
        expect(state.activeContentBlock).toBe(null);
        expect(state.nativeSelectionText).toBe('');
        // Focus stays on the editor root (not a cell caret) so copy/cut fire.
        expect(state.activeIsEditorRoot).toBe(true);
        expect(state.editorHasFocus).toBe(true);
    });

    test('Cmd/Ctrl+C copies the selected rectangle as a GFM sub-table', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'clipboard read unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await seedTable(page);

        await dragSelect(page, { row: 0, column: 0 }, { row: 1, column: 1 });
        await expect.poll(() => selectedCount(page)).toBe(4);

        await page.keyboard.press(`${metaKey()}+c`);

        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toContain('a1');
        expect(copied).toContain('b1');
        expect(copied).toContain('a2');
        expect(copied).toContain('b2');
        expect(copied).not.toContain('c1');
        expect(copied).not.toContain('a3');
        expect(copied).toMatch(/\|\s*-+/);
    });

    test('Cmd/Ctrl+X cuts the selected rectangle, emptying only those cells', async ({ browserName, context, page }) => {
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
        expect(md).not.toMatch(/\bb2\b/);
        expect(md).toContain('c1');
        expect(md).toContain('a3');
    });
});
