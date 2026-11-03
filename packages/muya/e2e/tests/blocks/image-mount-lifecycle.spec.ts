import type { Route } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures/muya';

const IMAGE_URL = 'https://example.test/pending-image.png';
const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
);

test('pending images survive block moves and mount after the response arrives', async ({ page }) => {
    let capture!: (route: Route) => void;
    const pending = new Promise<Route>(resolve => capture = resolve);
    await page.route(IMAGE_URL, capture);
    await page.evaluate(url => window.muya!.setContent(`![moving](${url})\n\ntail`), IMAGE_URL);
    const route = await pending;
    await page.evaluate(() => {
        const muya = window.muya!;
        const page = muya.editor.scrollPage!;
        page.firstContentInDescendant()!.parent!.insertInto(page);
        muya.flush();
    });
    expect(await page.evaluate(() => window.muya!.editor.inlineEngine.renderer.mounts.size)).toBe(1);
    await route.fulfill({ contentType: 'image/png', body: ONE_PIXEL_PNG });
    const image = page.locator('.mu-image-container img');
    await expect(image).toHaveCount(1);
    await expect(image).toHaveJSProperty('naturalWidth', 1);
});

test('direct DOM removal and document rebuild release subscriptions before the shared load completes', async ({ page }) => {
    let capture!: (route: Route) => void;
    const pending = new Promise<Route>(resolve => capture = resolve);
    await page.route(IMAGE_URL, capture);
    await page.evaluate(url => window.muya!.setContent(`![one](${url})\n\n![two](${url})`), IMAGE_URL);
    const route = await pending;
    await page.evaluate(() => {
        window.muya!.domNode.querySelector('.mu-inline-image')!.remove();
    });
    await expect.poll(() => page.evaluate(() => window.muya!.editor.inlineEngine.renderer.mounts.size)).toBe(1);
    await page.evaluate(() => window.muya!.setContent('replacement'));
    await expect.poll(() => page.evaluate(() => window.muya!.editor.inlineEngine.renderer.mounts.size)).toBe(0);
    await route.fulfill({ contentType: 'image/png', body: ONE_PIXEL_PNG });
    await expect.poll(() => page.evaluate(() => window.muya!.editor.inlineEngine.renderer.images.get('https://example.test/pending-image.png')?.isSuccess)).toBe(true);
    await expect(page.locator('.mu-image-container img')).toHaveCount(0);
});
