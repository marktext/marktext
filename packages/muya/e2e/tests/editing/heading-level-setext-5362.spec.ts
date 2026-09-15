import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5362: Promote / Demote Heading (Cmd+= / Cmd+- in the desktop app) treated a
// setext heading as a paragraph: Promote made it level 6, Demote did nothing.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function placeCaretAtEndOfTitle(page: Page): Promise<void> {
    await page.evaluate(() => {
        const title = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        title.setCursor(title.text.length, title.text.length, true);
    });
}

test.describe('promote / demote heading on a setext heading (#5362)', () => {
    test('a level-2 setext heading promotes to level 1', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, 'Title\n---\n\nafter\n');

        await placeCaretAtEndOfTitle(page);
        await page.evaluate(() => window.muya!.updateParagraph('upgrade heading'));
        await page.keyboard.type('!');
        await expect.poll(() => getMarkdown(page)).toBe('# Title!\n\nafter\n');
        expect(errors).toEqual([]);
    });

    test('a level-1 setext heading demotes to level 2', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, 'Title\n===\n\nafter\n');

        await placeCaretAtEndOfTitle(page);
        await page.evaluate(() => window.muya!.updateParagraph('degrade heading'));
        await expect.poll(() => getMarkdown(page)).toBe('## Title\n\nafter\n');
        expect(errors).toEqual([]);
    });
});
