import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';

// The desktop find bar closes with `muya.search('', { selectHighlight: true })`,
// which drops the caret back onto the last active match.
async function closeSearch(page: Page): Promise<string | null> {
    return page.evaluate(() => {
        try {
            window.muya!.search('', { selectHighlight: true });
            return null;
        }
        catch (error) {
            return String(error);
        }
    });
}

test('#5163 closing search after the matched heading was turned into a paragraph does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    await page.evaluate(() => window.muya!.setContent('# foo\n\nbar\n'));
    await page.evaluate(() => window.muya!.search('foo'));
    await page.evaluate(() => {
        window.muya!.editor.scrollPage.firstContentInDescendant().setCursor(0, 0, true);
    });
    await page.waitForTimeout(150);
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('foo\n\nbar\n');

    expect(await closeSearch(page)).toBeNull();

    await page.keyboard.type('x', { delay: 30 });
    await expect.poll(() => getMarkdown(page)).toContain('x');
    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
});
