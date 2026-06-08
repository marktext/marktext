import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * `focusMode` option + `Muya#setFocusMode`.
 *
 * Focus mode dims every top-level block except the one holding the cursor.
 * It is driven by the `mu-focus-mode` class on the `.mu-editor` root:
 *   - applied at construction when `new Muya(el, { focusMode: true })`
 *     (source: `packages/core/src/muya.ts::getContainer`),
 *   - toggled at runtime by `muya.setFocusMode(bool)`.
 * The dimming itself lives in CSS (`.mu-focus-mode .mu-container > *`).
 *
 * This used to be a no-op (the option was declared and the class reserved but
 * never applied); these specs lock in the implemented behavior.
 */
test.describe('options / focus-mode', () => {
    test('focusMode: true — root carries mu-focus-mode, option reflected, editor usable', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ focusMode: true });
            window.muya!.setContent('# heading\n\nparagraph A\n\nparagraph B\n');
        });

        const focusModeOption = await page.evaluate(() => window.muya!.options.focusMode);
        expect(focusModeOption).toBe(true);

        // The class is applied to the editor root at construction.
        await expect(page.locator(editor.focusModeRoot)).toBeVisible();

        // Sanity: editor renders multiple blocks and can be focused.
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
        await expect(page.locator(editor.paragraph).nth(0)).toContainText('paragraph A');
        await expect(page.locator(editor.paragraph).nth(1)).toContainText('paragraph B');

        // Click into paragraph B; the editor should remain alive and the active
        // block keeps full opacity while the others are dimmed.
        await page.locator(editor.paragraph).nth(1).click();
        const focused = await page.evaluate(() => {
            const active = window.muya!.editor.activeContentBlock;
            return active != null;
        });
        expect(focused).toBe(true);

        // Exactly one top-level block (the active one) is at full opacity; the
        // rest are dimmed to 0.25. Use auto-retrying `toHaveCSS` so the
        // `opacity 0.2s` transition has settled before we read the value.
        const activeBlock = page.locator('.mu-container > .mu-active');
        await expect(activeBlock).toHaveCount(1);
        await expect(activeBlock).toHaveCSS('opacity', '1');

        const inactiveBlocks = page.locator('.mu-container > :not(.mu-active)');
        const inactiveCount = await inactiveBlocks.count();
        expect(inactiveCount).toBeGreaterThan(0);
        for (let i = 0; i < inactiveCount; i++)
            await expect(inactiveBlocks.nth(i)).toHaveCSS('opacity', '0.25');
    });

    test('focusMode: false (default) — option reflected as false, no class', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ focusMode: false });
        });

        const value = await page.evaluate(() => window.muya!.options.focusMode);
        expect(value).toBe(false);

        await expect(page.locator(editor.root)).toBeVisible();
        await expect(page.locator(editor.focusModeRoot)).toHaveCount(0);
    });

    test('setFocusMode toggles the class and option at runtime', async ({ page }) => {
        await page.evaluate(() => window.__e2e!.rebuildMuya({ focusMode: false }));
        await expect(page.locator(editor.focusModeRoot)).toHaveCount(0);

        await page.evaluate(() => window.muya!.setFocusMode(true));
        expect(await page.evaluate(() => window.muya!.options.focusMode)).toBe(true);
        await expect(page.locator(editor.focusModeRoot)).toBeVisible();

        await page.evaluate(() => window.muya!.setFocusMode(false));
        expect(await page.evaluate(() => window.muya!.options.focusMode)).toBe(false);
        await expect(page.locator(editor.focusModeRoot)).toHaveCount(0);
    });
});
