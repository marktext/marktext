import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

const BLOCK_DOC = `# Title\n\nSome text before the image.\n\n![](${DATA_URI})\n\nText after the image.\n`;
const INLINE_DOC = `Before text ![](${DATA_URI}) after text.\n\nAnother paragraph.\n`;

async function selectFirstImage(page: import('@playwright/test').Page) {
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    await image.locator('img').first().click();
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.image != null)).toBe(true);
}

test('#5390 a selected image keeps a real selection over its markdown source', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), BLOCK_DOC);
    await selectFirstImage(page);

    const state = await page.evaluate(() => {
        const block = window.muya!.editor.selection.anchorBlock!;
        return {
            anchor: window.muya!.editor.selection.anchor?.offset,
            focus: window.muya!.editor.selection.focus?.offset,
            blockTextLength: block.text.length,
            domRangeCount: document.getSelection()?.rangeCount ?? -1,
            // Selecting the source must not drop the block back to raw markdown.
            renderedImages: document.querySelectorAll('.mu-inline-image img').length,
            // An object selection, not text the reader picked out — the desktop
            // shell counts this for its selected-word display.
            selectedText: window.muya!.editor.selection.getSelectedText(),
        };
    });

    // The whole `![](…)` source, and nothing else, is what is selected.
    expect(state.anchor).toBe(0);
    expect(state.focus).toBe(state.blockTextLength);
    // The editor used to be left with no range at all, which is what sent edits
    // to the top of the document.
    expect(state.domRangeCount).toBe(1);
    expect(state.renderedImages).toBe(1);
    expect(state.selectedText).toBe('');
});

test('#5390 selecting an image does not offer the inline format toolbar', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), BLOCK_DOC);
    await selectFirstImage(page);
    await page.waitForTimeout(400);

    // Bold/italic mean nothing for an image, but the source-range selection is
    // non-collapsed, which is the toolbar's usual cue.
    const shown = await page.evaluate(() => {
        const el = document.querySelector('.mu-format-picker');
        const wrapper = el?.closest('.mu-float-wrapper') ?? el?.parentElement;
        return wrapper ? getComputedStyle(wrapper).opacity : 'missing';
    });
    expect(shown).toBe('0');
});

test('#5390 typing over a selected block image replaces it, at the image', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    await page.evaluate(md => window.muya!.setContent(md), BLOCK_DOC);
    await selectFirstImage(page);

    await page.keyboard.type('xyz', { delay: 50 });
    await page.waitForTimeout(200);

    // The letters used to land in the collapsed `# ` marker at the top of the
    // document, one "Unexpected renderer process error" dialog per key, and
    // never reach the document at all.
    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(
        '# Title\n\nSome text before the image.\n\nxyz\n\nText after the image.\n',
    );
});

test('#5390 typing over a selected inline image replaces only the image', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    await page.evaluate(md => window.muya!.setContent(md), INLINE_DOC);
    await selectFirstImage(page);

    await page.keyboard.type('xyz', { delay: 50 });
    await page.waitForTimeout(200);

    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(
        'Before text xyz after text.\n\nAnother paragraph.\n',
    );
});

test('#5390 an IME keydown is left to the composition, not typed literally', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), INLINE_DOC);
    await selectFirstImage(page);

    // Chromium marks the keydown an IME owns with keyCode 229, one keydown
    // before `isComposing` turns true. Taking it inserts the raw letter and the
    // IME then commits its character after it, e.g. `wo` -> `w我`.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: 229,
        key: 'w',
    });
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(INLINE_DOC);
    expect(await page.evaluate(() => window.muya!.editor.selection.image != null)).toBe(true);
});

test('#5390 a replaced image comes back with one undo', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), INLINE_DOC);
    await selectFirstImage(page);

    await page.keyboard.type('x', { delay: 50 });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.muya!.undo());
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(INLINE_DOC);
});

test('#5390 Escape hands the keyboard back to the caret without touching the image', async ({ page }) => {
    await page.evaluate(md => window.muya!.setContent(md), INLINE_DOC);
    await selectFirstImage(page);

    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.image == null)).toBe(true);

    // The caret sits just after the image, so typing continues from there.
    await page.keyboard.type('!', { delay: 50 });
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(
        `Before text ![](${DATA_URI})! after text.\n\nAnother paragraph.\n`,
    );
});

test('#5390 the caret still types normally after the image selection is dropped', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    await page.evaluate(md => window.muya!.setContent(md), INLINE_DOC);
    await selectFirstImage(page);

    await page.locator(editor.paragraph).last().click();
    await page.keyboard.type('!', { delay: 50 });
    await page.waitForTimeout(200);

    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toContain('Another paragraph.!');
});
