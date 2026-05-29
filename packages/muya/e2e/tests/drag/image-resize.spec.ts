import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * ImageResizeBar drag.
 *
 * The bar is a bespoke (non-baseFloat) plugin. On image click, the
 * selection layer emits `muya-transformer` with the image container as
 * the reference; the plugin appends two `.bar.left` / `.bar.right`
 * handles to `.mu-transformer`. Mousedown on a handle wires document
 * mousemove + mouseup; mousemove rewrites `image.width` attribute
 * directly; mouseup calls `format.updateImage(info, 'width', String(N))`
 * which rewrites the surrounding markdown to embed an `<img …>` with the
 * new width.
 *
 * Plain markdown `![alt](src)` (no data-align attr) defaults to block
 * alignment (see `packages/core/src/selection/imageDisplay.ts`), so
 * `shouldShowImageResizeBar` is true and the handles materialise on
 * click.
 *
 * Contract under test: drag the right handle outwards → final markdown
 * contains `<img …>` with a `width="…"` larger than the natural width.
 */

test.describe('ImageResizeBar', () => {
    test('right handle drag updates image width in markdown', async ({ page }) => {
        // Use a tiny inline data-URI image so the network never sees a
        // request (the host's `__e2e.PICKED_IMAGE_URL` points at a fake
        // example.test URL — it would fail to load and Selection's
        // click handler would skip the `target.tagName === 'IMG'` branch
        // we need to fire `muya-transformer`).
        //
        // 1×1 transparent PNG, base64.
        const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
        await page.evaluate(uri => window.muya!.setContent(`![alt](${uri})`), dataUri);

        const image = page.locator(editor.image).first();
        await expect(image).toBeVisible();

        // The bar listens for `muya-transformer` emitted from Selection's
        // click handler — we need a *user* click on the <img> itself, not
        // its wrapper, so that the selection layer takes the
        // `target.tagName === 'IMG'` branch. Wait for the wrapper to flip
        // to `.mu-image-success` so the <img> child is present.
        await expect.poll(async () => image.evaluate(el =>
            el.classList.contains('mu-image-success')), { timeout: 5_000 }).toBe(true);
        const innerImg = image.locator('img').first();
        await expect(innerImg).toBeVisible();
        await innerImg.click();

        // Two .bar elements (left + right) get appended to .mu-transformer.
        const handles = page.locator(floats.imageTransformerHandle);
        await expect(handles).toHaveCount(2);
        const rightHandle = page.locator(`${floats.imageTransformer} .bar.right`);
        await expect(rightHandle).toBeVisible();

        // Record the natural width so we can assert growth.
        const startBox = await innerImg.boundingBox();
        if (!startBox)
            throw new Error('image has no bounding box');
        const startWidth = Math.round(startBox.width);

        const handleBox = await rightHandle.boundingBox();
        if (!handleBox)
            throw new Error('right handle has no bounding box');
        const handleCx = handleBox.x + handleBox.width / 2;
        const handleCy = handleBox.y + handleBox.height / 2;

        await page.mouse.move(handleCx, handleCy);
        await page.mouse.down();
        // Drag 80 px to the right. mouseMove uses `event.clientX - leftHandleRect.left`
        // directly (no 300 ms timer here, unlike the other drag plugins),
        // so a few intermediate steps + a final move is enough.
        await page.mouse.move(handleCx + 40, handleCy, { steps: 4 });
        await page.mouse.move(handleCx + 80, handleCy, { steps: 4 });
        await page.mouse.up();

        // After mouseup → updateImage rewrites the surrounding text and
        // re-renders; the new markdown will embed an explicit width on
        // the <img> tag.
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/<img\s[^>]*width="(\d+)"/i);

        const md = await getMarkdown(page);
        const match = md.match(/<img\s[^>]*width="(\d+)"/i);
        expect(match).not.toBeNull();
        const recordedWidth = Number.parseInt(match![1]);
        // Two independent guarantees, both must hold:
        //   (1) the bar clamps to a 50-px floor, so the recorded width
        //       can never drop below that regardless of the drag.
        //   (2) we dragged ~80 px outward from the right handle, so the
        //       recorded width should *exceed* the pre-drag natural
        //       width (startWidth) — this is the real "drag worked"
        //       assertion. A regression that pins width to start would
        //       fail here but pass (1).
        expect(recordedWidth).toBeGreaterThanOrEqual(50);
        expect(recordedWidth).toBeGreaterThan(startWidth);
    });
});
