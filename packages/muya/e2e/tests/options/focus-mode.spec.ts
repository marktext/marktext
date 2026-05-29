import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * `focusMode: true` constructor option.
 *
 * Current state of the codebase: `focusMode` is declared in
 * `IMuyaOptions`, defaulted to `false`, and reserved a class name
 * `CLASS_NAMES.MU_FOCUS_MODE` ('mu-focus-mode') — but no code path
 * actually applies that class to the DOM when the option is enabled.
 * This makes focus-mode currently a no-op option.
 *
 * What this spec asserts (the option *is* respected by the constructor):
 *   1. `new Muya(container, { focusMode: true })` boots without crashing.
 *   2. `muya.options.focusMode === true` after rebuild.
 *   3. The active paragraph can still be focused and typed into.
 *
 * What this spec deliberately does NOT assert: a visual marker on
 * non-active paragraphs. There is no such marker today. See BACKLOG
 * Phase 5 follow-up — once focus-mode renders a marker class, this
 * spec should be tightened to assert it.
 */
test.describe('options / focus-mode', () => {
    test('focusMode: true — rebuild boots, option reflected, editor usable', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ focusMode: true });
            window.muya!.setContent('# heading\n\nparagraph A\n\nparagraph B\n');
        });
        const focusModeOption = await page.evaluate(() => window.muya!.options.focusMode);
        expect(focusModeOption).toBe(true);

        // Sanity: editor renders multiple blocks and can be focused.
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
        await expect(page.locator(editor.paragraph).nth(0)).toContainText('paragraph A');
        await expect(page.locator(editor.paragraph).nth(1)).toContainText('paragraph B');

        // Click into paragraph B; the editor should remain alive.
        await page.locator(editor.paragraph).nth(1).click();
        const focused = await page.evaluate(() => {
            const active = window.muya!.editor.activeContentBlock;
            return active != null;
        });
        expect(focused).toBe(true);
    });

    test('focusMode: false (default) — option reflected as false', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ focusMode: false });
        });
        const value = await page.evaluate(() => window.muya!.options.focusMode);
        expect(value).toBe(false);
    });
});
