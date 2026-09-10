import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { floats, quickInsertItem } from '../helpers/selectors';

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function openMenuInNewParagraph(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent('first\n'));
    await page.evaluate(() => {
        window.muya!.editor.scrollPage.firstContentInDescendant().setCursor(5, 5, true);
    });
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await expect(page.locator(floats.quickInsert)).toBeVisible();
}

test.describe('quick-insert menu whose paragraph left the document (#5213)', () => {
    test('picking an item after the paragraph was removed does not crash', async ({ page }) => {
        const errors = collectErrors(page);
        await openMenuInNewParagraph(page);

        await page.evaluate(() => {
            window.muya!.editor.activeContentBlock.parent.remove();
        });
        await page.locator(quickInsertItem('bullet-list')).click({ force: true });
        await page.waitForTimeout(300);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        await expect.poll(() => page.evaluate(() =>
            [...window.muya!.ui.shownFloat].some(float =>
                (float.constructor as { pluginName?: string }).pluginName === 'quickInsert'),
        )).toBe(false);
    });
});
