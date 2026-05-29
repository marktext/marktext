import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

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
});
