import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// A cross-block cut that ends inside a table: #5400 removed the blocks after
// the list holding the table, #5399 kept the rest of that list, #5405 moved the
// unselected cell text out of the table and kept a fully selected table, and
// #5398 left the emptied cells showing their old text.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function selectFromTo(page: Page, startText: string, startOffset: number, endText: string, endOffset: number): Promise<void> {
    await page.evaluate(({ startText, startOffset, endText, endOffset }) => {
        const { scrollPage, selection } = window.muya!.editor;
        const find = (text: string) => {
            let block = scrollPage!.firstContentInDescendant();
            while (block && block.text !== text)
                block = block.nextContentInContext() ?? null;
            return block!;
        };
        const start = find(startText);
        const end = find(endText);
        selection.setSelection(
            { offset: startOffset, block: start, path: start.path },
            { offset: endOffset, block: end, path: end.path },
        );
    }, { startText, startOffset, endText, endOffset });
}

function cellTexts(page: Page): Promise<string[]> {
    return page.evaluate(() => [...document.querySelectorAll('.mu-table-cell-content')].map(cell => (cell as HTMLElement).textContent ?? ''));
}

test.describe('cut ending in a table', () => {
    test('keeps the blocks after the list the table is nested in (#5400, #5398)', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n\n  | h |\n  | --- |\n  | 1 |\n\nafter\n\nmore\n');

        await selectFromTo(page, 'a', 1, '1', 0);
        await page.keyboard.press('Backspace');

        await expect.poll(() => getMarkdown(page)).toContain('after');
        expect(await getMarkdown(page)).toContain('more');
        // The header cell is emptied on screen, and the unselected `1` stays.
        await expect.poll(() => cellTexts(page)).toEqual(['', '1']);
        expect(errors).toEqual([]);
    });

    test('removes a table that lies entirely inside the selection (#5405)', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n\n| h |\n| --- |\n| 1 |\n\ntail\n');

        await selectFromTo(page, 'a', 1, '1', 1);
        await page.keyboard.press('Backspace');

        await expect.poll(() => getMarkdown(page)).toBe('- a\n\ntail\n');
        await expect(page.locator(editor.table)).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('removes the rest of the list and keeps the unselected cell text (#5399, #5405)', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n- b\n\n| h |\n| --- |\n| 12 |\n| 34 |\n');

        await selectFromTo(page, 'a', 1, '12', 1);
        await page.keyboard.press('Backspace');

        await expect.poll(() => getMarkdown(page)).not.toContain('- b');
        await expect.poll(() => cellTexts(page)).toEqual(['', '2', '34']);
        expect(errors).toEqual([]);
    });
});
