import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5423: the quote's remaining paragraphs were moved out of it.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function deleteAtEndOfA(page: Page): Promise<void> {
    await page.locator('.mu-paragraph-content').filter({ hasText: /^a$/ }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Delete');
    await page.keyboard.type('Z');
}

test.describe('forward Delete before a blockquote (#5423)', () => {
    test('keeps the rest of the blockquote quoted', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, 'a\n\n> p\n>\n> q\n');

        await deleteAtEndOfA(page);

        await expect.poll(() => getMarkdown(page)).toBe('aZp\n\n> q\n');
        expect(errors).toEqual([]);
    });

    test('keeps the rest of a blockquote nested in a list item quoted', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- a\n\n  > p\n  >\n  > q\n');

        await deleteAtEndOfA(page);

        await expect.poll(() => getMarkdown(page)).toBe('- aZp\n\n  > q\n');
        expect(errors).toEqual([]);
    });
});
