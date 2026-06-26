import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// `**hello**bar`: source offsets — `**`(0-2) `hello`(2-7) `**`(7-9) `bar`(9-12).
// The strong token spans [0, 9]. With the caret at offset 6 (`**hell|o**`) the
// caret is inside the token, so the `**` markers render revealed (`.mu-gray`).
// Moving the caret all the way to the end (offset 12, after `bar`) takes it
// clear of the token, so the markers must collapse back to `.mu-hide`.
const strongMarkerHidden = `${editor.paragraph} span.mu-remove.mu-hide`;
const strongMarkerGray = `${editor.paragraph} span.mu-remove.mu-gray`;

async function setupCaretInsideStrong(page: Page) {
    await page.evaluate(() => window.muya!.setContent('**hello**bar'));
    // Focus the contenteditable so subsequent keyboard events drive the caret.
    await page.locator(editor.paragraph).first().click();
    // Park the caret at offset 6 (`**hell|o**bar`), inside the strong token, so
    // the markers render revealed.
    await page.evaluate(() => {
        const block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        block.setCursor(6, 6, true);
    });
    // Sanity: markers are revealed while the caret sits inside the token.
    await expect(page.locator(strongMarkerGray)).toHaveCount(2);
    await expect(page.locator(strongMarkerHidden)).toHaveCount(0);
}

async function caretOffset(page: Page): Promise<number | null> {
    return page.evaluate(() => {
        const sel = window.muya!.editor.selection.getSelection();
        return sel ? sel.anchor.offset : null;
    });
}

test.describe('emphasis markers auto-hide when arrowing out of the token', () => {
    test('tapping ArrowRight to the line end hides the markers', async ({ page }) => {
        await setupCaretInsideStrong(page);

        // Tap (down + up per press) six times: offset 6 -> 12 (after `bar`).
        for (let i = 0; i < 6; i++)
            await page.keyboard.press('ArrowRight');

        expect(await caretOffset(page)).toBe(12);
        await expect(page.locator(strongMarkerHidden)).toHaveCount(2);
        await expect(page.locator(strongMarkerGray)).toHaveCount(0);
    });

    test('holding ArrowRight to the line end hides the markers', async ({ page }) => {
        await setupCaretInsideStrong(page);

        // Hold: six trusted keydown events (autoRepeat) and a single keyup on
        // release — the caret travels offset 6 -> 12 (after `bar`) but only one
        // keyup fires, exactly like physically holding the arrow key.
        for (let i = 0; i < 6; i++)
            await page.keyboard.down('ArrowRight');
        await page.keyboard.up('ArrowRight');

        expect(await caretOffset(page)).toBe(12);
        await expect(page.locator(strongMarkerHidden)).toHaveCount(2);
        await expect(page.locator(strongMarkerGray)).toHaveCount(0);
    });
});
