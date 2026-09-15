import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5385: replacing a selection that starts inside a list or quote and ends in a
// block after it kept the selected rest of that list or quote.

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

test.describe('cut starting inside a list or quote (#5385)', () => {
    test('Backspace removes the selected rest of the list', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n- b\n- c\n\ntail\n');

        await selectFromTo(page, 'a', 1, 'tail', 4);
        await page.keyboard.press('Backspace');

        await expect.poll(() => getMarkdown(page)).toBe('- a\n');
        await page.keyboard.type('!');
        await expect.poll(() => getMarkdown(page)).toBe('- a!\n');
        expect(errors).toEqual([]);
    });

    test('typing over the selection removes the selected rest of the quote', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '> a\n>\n> b\n\ntail\n');

        await selectFromTo(page, 'a', 1, 'tail', 2);
        await page.keyboard.type('X');

        await expect.poll(() => getMarkdown(page)).toBe('> aXil\n');
        expect(errors).toEqual([]);
    });
});
