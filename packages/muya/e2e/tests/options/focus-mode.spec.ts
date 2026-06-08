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

        const dimmed = await page.evaluate(() => {
            const blocks = Array.from(document.querySelectorAll('.mu-container > *')) as HTMLElement[];
            return blocks.map((b) => {
                const isActive = b.classList.contains('mu-active');
                return { isActive, opacity: getComputedStyle(b).opacity };
            });
        });
        // Exactly one top-level block (the active one) is at full opacity; the
        // rest are dimmed to 0.25.
        const active = dimmed.filter(b => b.isActive);
        const inactive = dimmed.filter(b => !b.isActive);
        expect(active.length).toBe(1);
        expect(active[0].opacity).toBe('1');
        expect(inactive.length).toBeGreaterThan(0);
        for (const b of inactive)
            expect(b.opacity).toBe('0.25');
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
