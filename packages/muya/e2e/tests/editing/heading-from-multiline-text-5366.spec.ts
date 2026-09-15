import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5366: turning a paragraph with a line break into a heading (Heading 1-6,
// Promote Heading) saved only its first line.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

test.describe('heading from a paragraph with a line break (#5366)', () => {
    test('Heading 2 keeps both lines of a Shift+Enter paragraph', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, 'first\n\nafter\n');
        await page.evaluate(() => {
            const first = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            first.setCursor(first.text.length, first.text.length, true);
        });

        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('second');
        await expect.poll(() => getMarkdown(page)).toBe('first\nsecond\n\nafter\n');

        await page.evaluate(() => window.muya!.updateParagraph('heading 2'));
        await expect.poll(() => getMarkdown(page)).toBe('## first second\n\nafter\n');
        expect(errors).toEqual([]);
    });
});
