import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * Both resize handles must track the pointer 1:1 (#5392).
 *
 * A left-aligned image grows on its right side, so its right edge is not an
 * invariant the left handle can measure against: reading it live once per
 * mousemove made every event re-add the whole accumulated delta, so a 60 px
 * drag grew the image by 210 px and kept the pointer far behind the handle.
 *
 * The fixture is 400×300 on purpose. `usesDefaultObjectSize` pins an inline
 * `style="width"` on any image measuring 300 wide or 150 tall (#4991), and
 * that style beats the `width` attribute the bar writes, so such an image
 * never resizes at all. 400 also leaves room inside the editor column for the
 * drags below, so no `max-width: 100%` clamp interferes.
 */
const IMAGE = `data:image/svg+xml;base64,${btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#48c"/></svg>',
)}`;

const DRAG = 60;
// Only sub-pixel geometry and the integer truncation of the written width
// separate the two; the accumulation bug missed by 150 px on this drag.
const TOLERANCE = 4;

async function showHandles(page: Page) {
    await page.evaluate(uri => window.muya!.setContent(`![alt](${uri})`), IMAGE);

    const image = page.locator(editor.image).first();
    await expect(image).toBeVisible();
    await expect.poll(async () => image.evaluate(el =>
        el.classList.contains('mu-image-success')), { timeout: 5_000 }).toBe(true);

    const innerImg = image.locator('img').first();
    await expect(innerImg).toBeVisible();
    await innerImg.click();
    await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(2);

    const box = await innerImg.boundingBox();
    if (!box)
        throw new Error('image has no bounding box');

    return { startWidth: Math.round(box.width) };
}

/** Drags one handle `dx` px and reports the width it saved and the width it shows. */
async function dragHandle(page: Page, position: 'left' | 'right', dx: number) {
    const box = await page.locator(`${floats.imageTransformer} .bar.${position}`).boundingBox();
    if (!box)
        throw new Error(`${position} handle has no bounding box`);

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Six discrete moves: the bug compounded per event, so a stepped drag
    // separates "follows the pointer" from "re-adds the delta every time".
    for (let i = 1; i <= 6; i++)
        await page.mouse.move(cx + (dx * i) / 6, cy);

    await page.mouse.up();

    // Mouseup rewrites the markdown around the image as an explicit <img>.
    await expect.poll(async () => getMarkdown(page), {
        timeout: 5_000,
        intervals: [50, 100, 250, 500],
    }).toMatch(/<img\s[^>]*width="\d+"/i);

    const saved = Number.parseInt((await getMarkdown(page)).match(/<img\s[^>]*width="(\d+)"/i)![1]);
    const shown = await page.locator(editor.image).first().locator('img').first()
        .evaluate(el => Math.round(el.getBoundingClientRect().width));

    return { saved, shown };
}

test.describe('ImageResizeBar handle tracking (#5392)', () => {
    test('dragging the left handle outwards widens by the distance dragged', async ({ page }) => {
        const { startWidth } = await showHandles(page);

        const { saved, shown } = await dragHandle(page, 'left', -DRAG);

        expect(Math.abs(saved - (startWidth + DRAG))).toBeLessThanOrEqual(TOLERANCE);
        // The width written to the file is the width on screen — the runaway
        // used to save 710 for an image displayed at the 650 px column width.
        expect(Math.abs(shown - saved)).toBeLessThanOrEqual(TOLERANCE);
    });

    test('dragging the left handle inwards narrows by the distance dragged', async ({ page }) => {
        const { startWidth } = await showHandles(page);

        const { saved } = await dragHandle(page, 'left', DRAG);

        expect(Math.abs(saved - (startWidth - DRAG))).toBeLessThanOrEqual(TOLERANCE);
    });

    test('dragging the right handle outwards widens by the distance dragged', async ({ page }) => {
        const { startWidth } = await showHandles(page);

        const { saved } = await dragHandle(page, 'right', DRAG);

        expect(Math.abs(saved - (startWidth + DRAG))).toBeLessThanOrEqual(TOLERANCE);
    });
});
