import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

/**
 * Read the inline `opacity` the float's `.mu-float-wrapper` carries.
 *
 * baseFloat hides a float by leaving the wrapper at the CSS default
 * (`opacity: 0`, off-screen at `-9999px`) and shows it by setting an inline
 * `opacity: 1` + an on-screen position once `computePosition` resolves
 * (see ui/baseFloat/index.ts `show`/`hide`). Playwright's `toBeVisible`
 * ignores `opacity`, so a hidden float still reports visible — the inline
 * opacity is the reliable shown/hidden signal (same trick as
 * ui/paragraph-front.spec.ts).
 */
async function floatOpacity(page: Page, selector: string): Promise<number> {
    return page.locator(selector).evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        return Number.parseFloat(wrapper?.style.opacity || '0');
    });
}

/** The on-screen top the wrapper is positioned at once shown (px). */
async function floatTop(page: Page, selector: string): Promise<string> {
    return page.locator(selector).evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        return wrapper?.style.top || '';
    });
}

test.describe('image tools', () => {
    test('setContent with an image renders an inline image element', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('![alt](https://example.test/host-img.png "t")');
        });
        await expect(page.locator(editor.image).first()).toBeVisible();
    });

    test('image-selector (edit tool) and image-toolbar float roots are registered', async ({ page }) => {
        await expect(page.locator(floats.imageEditTool)).toHaveCount(1);
        await expect(page.locator(floats.imageToolbar)).toHaveCount(1);
    });

    test('an empty image (`![]()`) renders the empty-image placeholder', async ({ page }) => {
        // With no resolvable src the inline image renderer takes its `else`
        // branch and tags the wrapper with `mu-empty-image`
        // (inlineRenderer/renderer/image.ts). The placeholder still carries the
        // raw markdown on `data-raw` and an empty `.mu-image-container`.
        await page.evaluate(() => {
            window.muya!.setContent('![]()');
        });

        const placeholder = page.locator(editor.emptyImage).first();
        await expect(placeholder).toBeVisible();
        await expect(placeholder).toHaveAttribute('data-raw', '![]()');
        // No real <img> is mounted for an empty image.
        await expect(page.locator(`${editor.image} img`)).toHaveCount(0);

        // The empty image round-trips losslessly through the serializer.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toBe('![]()\n');
    });

    test('clicking the empty-image placeholder opens the image edit tool', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('![]()');
        });

        const placeholder = page.locator(editor.emptyImage).first();
        await expect(placeholder).toBeVisible();

        // Before the click the edit-tool float is hidden — its wrapper sits at
        // the CSS default opacity 0 (no inline opacity has been written yet).
        expect(await floatOpacity(page, floats.imageEditTool)).toBe(0);

        // Clicking an empty-image wrapper fires `muya-image-selector`
        // (selection/ImageSelection.ts) which the ImageEditTool subscribes to
        // and shows itself. `show()` writes inline opacity 1 once
        // `computePosition` resolves.
        await placeholder.click();

        await expect.poll(
            async () => floatOpacity(page, floats.imageEditTool),
            { timeout: 3_000 },
        ).toBeGreaterThan(0);

        // And it is positioned on-screen (not parked at the -9999px hide spot).
        const top = await floatTop(page, floats.imageEditTool);
        expect(top).not.toBe('-9999px');
        expect(top).not.toBe('');

        // The shown tool is the link/embed editor: it renders the src input and
        // the Embed button (imageEditTool `_renderLinkBody`).
        const tool = page.locator(floats.imageEditTool);
        await expect(tool.locator('input.src')).toHaveCount(1);
        await expect(tool.locator('button.role-button.link')).toBeVisible();
    });

    test('an image with alt but no src is still treated as an empty placeholder', async ({ page }) => {
        // `![alt]()` has an alt but no resolvable src, so the renderer still
        // takes the empty-image branch. This is the same gate the click handler
        // checks (MU_EMPTY_IMAGE), so the edit tool opens on click too.
        await page.evaluate(() => {
            window.muya!.setContent('![alt]()');
        });

        const placeholder = page.locator(editor.emptyImage).first();
        await expect(placeholder).toBeVisible();
        await expect(placeholder).toHaveAttribute('data-raw', '![alt]()');

        expect(await floatOpacity(page, floats.imageEditTool)).toBe(0);

        await placeholder.click();

        await expect.poll(
            async () => floatOpacity(page, floats.imageEditTool),
            { timeout: 3_000 },
        ).toBeGreaterThan(0);
    });
});
