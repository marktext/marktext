import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function loadImage(page: Page): Promise<Locator> {
    await page.evaluate(uri => window.muya!.setContent(`before\n\n![alt](${uri})\n\nafter\n`), DATA_URI);
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    const innerImg = image.locator('img').first();
    await expect(innerImg).toBeVisible();
    return innerImg;
}

test.describe('ImageResizeBar after the image is deleted (#5216)', () => {
    test('deleting the image before the bar renders does not crash', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadImage(page);

        await innerImg.evaluate((img) => {
            img.click();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        });
        await page.waitForTimeout(200);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        await expect.poll(() => getMarkdown(page)).not.toContain('![alt]');
        await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(0);
    });

    test('deleting the image while dragging a resize handle does not crash', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadImage(page);

        await innerImg.click();
        const rightHandle = page.locator(`${floats.imageTransformer} .bar.right`);
        await expect(rightHandle).toBeVisible();
        const box = await rightHandle.boundingBox();
        if (!box)
            throw new Error('right handle has no bounding box');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.keyboard.press('Delete');
        await expect.poll(() => getMarkdown(page)).not.toContain('![alt]');
        await page.mouse.move(x + 40, y, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(200);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });
});
