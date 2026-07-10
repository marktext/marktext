import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

/**
 * #2939 — the ImageResizeBar positioned its left/right handles once on image
 * click and never tracked layout reflow (unlike imageToolbar, which rides
 * baseFloat's `autoUpdate`). When the surrounding layout shifted — the desktop
 * sidebar toggling, or any window/ancestor resize — the handles stayed at their
 * stale coordinates, detached from the image.
 *
 * Reproduce the reflow with a viewport resize (the muya container is centered,
 * so narrowing the viewport moves the image's left edge) and assert the left
 * handle stays aligned with the image.
 */

const DATA_URI =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

test.describe('ImageResizeBar reflow (#2939)', () => {
    test('left handle tracks the image when the viewport resizes', async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.evaluate(uri => window.muya!.setContent(`![alt](${uri})`), DATA_URI);

        const image = page.locator(editor.image).first();
        await expect(image).toBeVisible();
        await expect.poll(async () => image.evaluate(el =>
            el.classList.contains('mu-image-success')), { timeout: 5_000 }).toBe(true);

        const innerImg = image.locator('img').first();
        await innerImg.click();

        const leftHandle = page.locator(`${floats.imageTransformer} .bar.left`);
        await expect(leftHandle).toBeVisible();

        const offsetBefore = await getHandleOffset(innerImg, leftHandle);
        expect(Math.abs(offsetBefore)).toBeLessThan(4);

        // Narrow the viewport: the centered container — and the image — shift right.
        await page.setViewportSize({ width: 760, height: 900 });

        await expect.poll(async () => Math.abs(await getHandleOffset(innerImg, leftHandle)), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBeLessThan(4);
    });
});

async function getHandleOffset(img: Locator, handle: Locator): Promise<number> {
    const imgBox = await img.boundingBox();
    const handleBox = await handle.boundingBox();
    if (!imgBox || !handleBox)
        throw new Error('missing bounding box');
    // The left handle sits at `image.left - 5` (CIRCLE_RADIO); compare centers.
    return (handleBox.x + handleBox.width / 2) - imgBox.x;
}
