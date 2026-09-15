import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5360: Promote Heading (Cmd+= in the desktop app) with the caret in a list or
// quote replaced the whole list or quote with one heading. It must change only
// the paragraph holding the caret, and leave a table or code block alone.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function placeCaretAtEnd(page: Page, text: string): Promise<void> {
    await page.evaluate((text) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        block!.setCursor(text.length, text.length, true);
    }, text);
}

test.describe('promote / demote heading change the caret\'s paragraph (#5360)', () => {
    test('in a list, only the item holding the caret becomes a heading', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- item one\n- item two\n');

        await placeCaretAtEnd(page, 'item two');
        await page.evaluate(() => window.muya!.updateParagraph('upgrade heading'));
        await page.keyboard.type('!');
        await expect.poll(() => getMarkdown(page)).toBe('- item one\n- ###### item two!\n');

        await page.evaluate(() => window.muya!.updateParagraph('degrade heading'));
        await expect.poll(() => getMarkdown(page)).toBe('- item one\n- item two!\n');
        expect(errors).toEqual([]);
    });

    test('in a quote, only the paragraph holding the caret becomes a heading', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '> quote line\n>\n> second\n');

        await placeCaretAtEnd(page, 'second');
        await page.evaluate(() => window.muya!.updateParagraph('upgrade heading'));
        await expect.poll(() => getMarkdown(page)).toBe('> quote line\n>\n> ###### second\n');
        expect(errors).toEqual([]);
    });

    test('in a table cell, nothing changes', async ({ page }) => {
        const errors = collectPageErrors(page);
        const table = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
        await loadMarkdown(page, table);

        await placeCaretAtEnd(page, '2');
        await page.evaluate(() => window.muya!.updateParagraph('upgrade heading'));
        await page.keyboard.type('x');
        await expect.poll(() => getMarkdown(page)).toBe('| a   | b   |\n| --- | --- |\n| 1   | 2x  |\n');
        expect(errors).toEqual([]);
    });
});
