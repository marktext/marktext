import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

// The two shapes an image comes in. They take different paths through the
// browser — an image alone in its paragraph is the whole of a
// `contenteditable="false"` element, an inline one sits beside editable text —
// so every behaviour here is pinned for both.
const SHAPES = {
    'block image': {
        doc: `# Title\n\nBefore.\n\n![](${DATA_URI})\n\nAfter.\n`,
        withoutImage: '# Title\n\nBefore.\n\n\n\nAfter.\n',
    },
    'inline image': {
        doc: `# Title\n\nBefore ![](${DATA_URI}) after.\n`,
        withoutImage: '# Title\n\nBefore  after.\n',
    },
};

async function selectImage(page: import('@playwright/test').Page, doc: string) {
    await page.evaluate(md => window.muya!.setContent(md), doc);
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    await image.locator('img').first().click();
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.image != null)).toBe(true);
}

for (const [shape, { doc, withoutImage }] of Object.entries(SHAPES)) {
    // Backspace used to demote the document's first heading on its way through
    // (#5395); Enter inserted a paragraph above it and left the image in place
    // (#5396), because the editor's dispatch reached a block first.
    for (const key of ['Backspace', 'Delete', 'Enter']) {
        test(`#5395/#5396 ${shape}: ${key} removes only the image`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', err => errors.push(String(err?.message ?? err)));
            await selectImage(page, doc);

            await page.keyboard.press(key);
            await page.waitForTimeout(200);

            expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
            expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(withoutImage);
            expect(await page.evaluate(() => window.muya!.editor.selection.image)).toBeNull();
        });
    }

    test(`#5395/#5396 ${shape}: Space previews and edits nothing`, async ({ page }) => {
        await page.evaluate(() => {
            window.__previewCount = 0;
            window.muya!.eventCenter.subscribe('preview-image', () => {
                window.__previewCount!++;
            });
        });
        await selectImage(page, doc);

        await page.keyboard.press('Space');
        await page.waitForTimeout(200);

        expect(await page.evaluate(() => window.__previewCount)).toBe(1);
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(doc);
    });
}

test('#5395/#5396 the first heading keeps its level while an image is selected', async ({ page }) => {
    await selectImage(page, SHAPES['block image'].doc);

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    await expect(page.locator(editor.atxHeading)).toHaveCount(1);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toContain('# Title');
});

test('#5395/#5396 Backspace at the start of a heading still demotes it when the caret owns it', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('# Title\n\nBody.\n'));
    await page.locator(editor.atxHeading).first().click();
    await page.evaluate(() => {
        window.muya!.editor.scrollPage!.firstContentInDescendant().setCursor(0, 0, true);
    });

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('Title\n\nBody.\n');
});
