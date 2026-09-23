import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

async function loadImage(page: Page, markdown: string, autoFocus: boolean): Promise<Locator> {
    await page.evaluate(
        ([md, focus]) => window.muya!.setContent(md as string, focus as boolean),
        [markdown.replace('SRC', DATA_URI), autoFocus] as const,
    );
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    const innerImg = image.locator('img').first();
    await expect(innerImg).toBeVisible();
    return innerImg;
}

async function expectHandlesOnImage(page: Page, innerImg: Locator) {
    const handles = page.locator(floats.imageTransformerHandle);
    await expect(handles).toHaveCount(2);

    const imageBox = await innerImg.boundingBox();
    const leftBox = await page.locator(`${floats.imageTransformer} .bar.left`).boundingBox();
    const rightBox = await page.locator(`${floats.imageTransformer} .bar.right`).boundingBox();
    if (!imageBox || !leftBox || !rightBox)
        throw new Error('image or handles have no bounding box');

    // Each handle straddles its edge of the image, vertically centred on it.
    expect(Math.abs(leftBox.x + leftBox.width / 2 - imageBox.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(rightBox.x + rightBox.width / 2 - (imageBox.x + imageBox.width))).toBeLessThanOrEqual(6);
    const imageCy = imageBox.y + imageBox.height / 2;
    expect(Math.abs(leftBox.y + leftBox.height / 2 - imageCy)).toBeLessThanOrEqual(6);
}

test.describe('ImageResizeBar with the caret on the image\'s line (#5391)', () => {
    test('the first click places the handles on the image, not at the window corner', async ({ page }) => {
        // `autoFocus` puts the caret at offset 0 of the first block — the state
        // the editor is in right after a document that starts with an image is
        // opened. That caret makes the image token's markers "revealed", so
        // clearing it on click re-renders the paragraph.
        const innerImg = await loadImage(page, '![alt](SRC)\n\nafter\n', true);

        await innerImg.click();

        await expectHandlesOnImage(page, innerImg);
    });

    test('the handles and the toolbar follow the image when blurring shifts it', async ({ page }) => {
        // Blurring the paragraph hides the `**` markers the caret had revealed,
        // which reflows the line and moves the image sideways.
        const innerImg = await loadImage(page, '**bold** ![alt](SRC) tail\n', false);
        await page.evaluate(() =>
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(3, 3, true));

        await innerImg.click();

        await expectHandlesOnImage(page, innerImg);

        const imageBox = (await innerImg.boundingBox())!;
        const toolbarBox = (await page.locator(floats.imageToolbar).boundingBox())!;
        expect(Math.abs(
            toolbarBox.x + toolbarBox.width / 2 - (imageBox.x + imageBox.width / 2),
        )).toBeLessThanOrEqual(6);
    });

    test('the handles survive a click that first parked the caret on the image line', async ({ page }) => {
        const innerImg = await loadImage(page, '# Title\n\nbefore\n\n![alt](SRC)\n\nafter\n', false);

        // Park the caret on the image's own line by clicking the empty space to
        // the right of the image, as a user would.
        const imageBox = await innerImg.boundingBox();
        if (!imageBox)
            throw new Error('image has no bounding box');
        await page.mouse.click(imageBox.x + imageBox.width + 150, imageBox.y + imageBox.height / 2);

        await innerImg.click();

        await expectHandlesOnImage(page, innerImg);
    });
});
