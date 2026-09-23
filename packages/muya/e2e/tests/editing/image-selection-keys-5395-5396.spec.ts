import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

const DOC = `# Title\n\nSome text before the image.\n\n![](${DATA_URI})\n\nText after the image.\n`;
// `deleteImage` leaves the image's paragraph in place, empty.
const IMAGE_DELETED = '# Title\n\nSome text before the image.\n\n\n\nText after the image.\n';

async function selectImage(page: import('@playwright/test').Page) {
    await page.evaluate(md => window.muya!.setContent(md), DOC);
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    await image.locator('img').first().click();
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.image != null)).toBe(true);
}

// Backspace, Delete and Enter all mean "delete the selected image" to
// ImageSelection. Before the fix only Delete arrived intact: the editor's own
// keydown dispatch ran first and spent Backspace and Enter on the first block.
for (const key of ['Backspace', 'Delete', 'Enter']) {
    test(`#5395/#5396 ${key} on a selected image removes only the image`, async ({ page }) => {
        await selectImage(page);

        await page.keyboard.press(key);
        await page.waitForTimeout(200);

        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(IMAGE_DELETED);
        expect(await page.evaluate(() => window.muya!.editor.selection.image)).toBeNull();
    });
}

test('#5395/#5396 Space still previews the selected image and edits nothing', async ({ page }) => {
    await page.evaluate(() => {
        window.__previewCount = 0;
        window.muya!.eventCenter.subscribe('preview-image', () => {
            window.__previewCount!++;
        });
    });
    await selectImage(page);

    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.__previewCount)).toBe(1);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(DOC);
});

test('#5395/#5396 the first heading is untouched while an image is selected', async ({ page }) => {
    await selectImage(page);

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // The heading kept its level — Backspace never reached it.
    await expect(page.locator(editor.atxHeading).first()).toHaveCount(1);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toContain('# Title');
});

test('#5395/#5396 Backspace at the start of a heading still demotes it when the caret owns it', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('# Title\n\nBody.\n'));
    await page.locator(editor.atxHeading).first().click();
    await page.evaluate(() => {
        const first = window.muya!.editor.scrollPage!.firstContentInDescendant();
        first.setCursor(0, 0, true);
    });

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('Title\n\nBody.\n');
});
