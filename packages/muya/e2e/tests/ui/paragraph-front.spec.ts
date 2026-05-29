import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

test.describe('paragraph front button + menu', () => {
    test('front-menu float root mounts after editor init', async ({ page }) => {
        // The front menu is a registered baseFloat plugin. Its container is
        // appended to the DOM at construction; we just assert it exists.
        await expect(page.locator(floats.paragraphFrontMenu)).toHaveCount(1);
    });

    test('front-button wrapper is mounted by the plugin', async ({ page }) => {
        // ParagraphFrontButton.init() appends a `.mu-front-button-wrapper` div
        // to document.body at construction. Whether or not it's positioned
        // over a paragraph depends on hover state — but the wrapper itself
        // must exist as soon as muya.init() completes.
        await expect(page.locator(floats.paragraphFrontButton)).toHaveCount(1);
    });

    test('hovering a paragraph positions the front button over it', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a paragraph'));
        const para = page.locator(editor.paragraph).first();
        const wrapper = page.locator(floats.paragraphFrontButton);

        await para.hover();
        // After hover, the plugin assigns a non-zero size to the wrapper
        // (init() sets width/height from the inner container via
        // ResizeObserver). A zero-sized wrapper means the plugin never picked
        // up the paragraph.
        await expect.poll(async () => {
            return wrapper.evaluate((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
        }, { timeout: 3_000 }).toBe(true);
    });
});
