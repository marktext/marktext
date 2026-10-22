import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

/**
 * A resize drag that ends with the button released outside the window used to
 * be discarded: the image kept the size it had been dragged to, but nothing was
 * written to the document (#5393).
 *
 * A pointer past the viewport's edge is hit tested to `<html>`, so the release
 * bubbles html → document → window, never through `<body>` where the drag
 * listeners lived. The click that follows it hides the bar, which throws the
 * pending width away. The spec asserts the `<html>` target too — without it a
 * clamped or shortened drag would leave the regression uncovered.
 */
test.describe('image resize released outside the window (#5393)', () => {
    test('a release past the viewport edge commits the dragged width', async ({ page }) => {
        await page.evaluate(uri => window.muya!.setContent(`before\n\n![alt](${uri})\n\nafter\n`), DATA_URI);

        const image = page.locator(editor.image).first();
        await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
        const innerImg = image.locator('img').first();
        await expect(innerImg).toBeVisible();
        await innerImg.click();

        const startBox = await innerImg.boundingBox();
        if (!startBox)
            throw new Error('image has no bounding box');

        const rightHandle = page.locator(`${floats.imageTransformer} .bar.right`);
        await expect(rightHandle).toBeVisible();
        const handleBox = await rightHandle.boundingBox();
        if (!handleBox)
            throw new Error('right handle has no bounding box');
        const handleCx = handleBox.x + handleBox.width / 2;
        const handleCy = handleBox.y + handleBox.height / 2;

        await page.evaluate(() => {
            (window as unknown as { __releaseTarget?: string }).__releaseTarget = undefined;
            window.addEventListener('mouseup', (event) => {
                const target = event.target as Element | null;
                (window as unknown as { __releaseTarget?: string }).__releaseTarget = target?.tagName;
            }, { capture: true, once: true });
        });

        const viewport = page.viewportSize();
        if (!viewport)
            throw new Error('page has no viewport');
        const outsideX = viewport.width + 80;

        await page.mouse.move(handleCx, handleCy);
        await page.mouse.down();
        await page.mouse.move(handleCx + 40, handleCy, { steps: 4 });
        await page.mouse.move(outsideX, handleCy, { steps: 4 });
        await page.mouse.up();

        expect(await page.evaluate(() =>
            (window as unknown as { __releaseTarget?: string }).__releaseTarget)).toBe('HTML');

        await expect.poll(() => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/<img\s[^>]*width="(\d+)"/i);

        const width = Number.parseInt((await getMarkdown(page)).match(/<img\s[^>]*width="(\d+)"/i)![1]);
        expect(width).toBeGreaterThan(Math.round(startBox.width));
    });
});
