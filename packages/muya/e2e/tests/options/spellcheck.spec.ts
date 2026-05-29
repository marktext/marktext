import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * `spellcheckEnabled` option.
 *
 * Source of truth: `packages/core/src/muya.ts::getContainer` sets
 * `newContainer.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false')`
 * at editor construction. The attribute is on the `.mu-editor` root.
 */
test.describe('options / spellcheck', () => {
    test('spellcheckEnabled: true → editor root has spellcheck="true"', async ({ page }) => {
        await page.evaluate(() => window.__e2e!.rebuildMuya({ spellcheckEnabled: true }));
        const value = await page.locator(editor.root).getAttribute('spellcheck');
        expect(value).toBe('true');
    });

    test('spellcheckEnabled: false → editor root has spellcheck="false"', async ({ page }) => {
        await page.evaluate(() => window.__e2e!.rebuildMuya({ spellcheckEnabled: false }));
        const value = await page.locator(editor.root).getAttribute('spellcheck');
        expect(value).toBe('false');
    });
});
