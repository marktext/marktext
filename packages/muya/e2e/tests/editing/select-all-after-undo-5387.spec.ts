import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5387: undoing a new paragraph as the first edit after load restores no
// caret, and Select All then threw ("Cannot destructure property 'path' of
// 'this.parent' as it is null.") on the removed paragraph instead of selecting
// anything, so typing inserted at the caret and Backspace deleted nothing.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

// Undo and Select All through the API, as the desktop Edit menu does.
async function undoNewParagraphAfterFirstLine(page: Page, markdown: string): Promise<void> {
    await loadMarkdown(page, markdown);
    await page.locator(editor.paragraph).first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('b');
    await expect.poll(() => getMarkdown(page)).toContain('b');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(markdown);
}

for (const markdown of ['a\n', 'a\n\nc\n']) {
    test(`Select All after undoing a new paragraph in ${JSON.stringify(markdown)}, then typing, replaces the document (#5387)`, async ({ page }) => {
        const errors = collectPageErrors(page);
        await undoNewParagraphAfterFirstLine(page, markdown);

        await page.evaluate(() => window.muya!.selectAll());
        await page.keyboard.type('X');

        await expect.poll(() => getMarkdown(page)).toBe('X\n');
        expect(errors).toEqual([]);
    });
}

test('Backspace after Select All after undoing a new paragraph deletes the document (#5387)', async ({ page }) => {
    const errors = collectPageErrors(page);
    await undoNewParagraphAfterFirstLine(page, 'a\n');

    await page.evaluate(() => window.muya!.selectAll());
    await page.keyboard.press('Backspace');

    await expect.poll(() => getMarkdown(page)).toBe('\n');
    expect(errors).toEqual([]);
});
