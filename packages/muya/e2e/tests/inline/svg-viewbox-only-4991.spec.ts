import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * marktext#4991 — an SVG that states no width/height, only a `viewBox`, has no
 * intrinsic size. Such an image resolves its used width against its containing
 * block (CSS 2.1 §10.3.2), but `.mu-image-container` is shrink-to-fit: its
 * width comes from the image, the image's from it, and Chromium settles on 0 —
 * the image rendered as a 0×0 box and simply wasn't there.
 *
 * Contract: the rendered <img> is laid out at the CSS default object size
 * (300×150 contained to the viewBox ratio), the same box every browser gives
 * such an SVG in ordinary block flow.
 */

// 200×100 viewBox, no width/height attributes.
const VIEWBOX_ONLY_SVG
    = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzJlOGI1NyIvPjwvc3ZnPg==';

// 120×60, width/height stated — the control: it always had an intrinsic size.
const SIZED_SVG
    = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZjYzNDciLz48L3N2Zz4=';

async function renderedImageBox(page: import('@playwright/test').Page, src: string) {
    await page.evaluate(uri => window.muya!.setContent(`![](${uri})`), src);

    const wrapper = page.locator(editor.image).first();
    await expect
        .poll(async () => wrapper.evaluate(el => el.classList.contains('mu-image-success')), {
            timeout: 5_000,
        })
        .toBe(true);

    return wrapper.locator('img').first().boundingBox();
}

test.describe('SVG with only a viewBox (#4991)', () => {
    test('is laid out at the default object size instead of collapsing to 0', async ({ page }) => {
        const box = await renderedImageBox(page, VIEWBOX_ONLY_SVG);

        expect(box).not.toBeNull();
        expect(Math.round(box!.width)).toBe(300);
        expect(Math.round(box!.height)).toBe(150);
    });

    test('an SVG that states its own size keeps it', async ({ page }) => {
        const box = await renderedImageBox(page, SIZED_SVG);

        expect(box).not.toBeNull();
        expect(Math.round(box!.width)).toBe(120);
        expect(Math.round(box!.height)).toBe(60);
    });
});
