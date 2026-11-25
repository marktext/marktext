import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// The KaTeX / ruby preview is a contenteditable=false span placed right after
// the source text. Chromium spends an ArrowRight crossing it without changing
// the text offset, and the keyup repaint then put the caret back in front of
// it, so tapping ArrowRight could never get past the closing marker.

async function caretOffset(page: Page): Promise<number | undefined> {
    return page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.offset);
}

async function placeCaret(page: Page, markdown: string, offset: number) {
    await page.evaluate(md => window.muya!.setContent(md), markdown);
    await page.locator(editor.paragraph).first().click();
    await page.evaluate((o) => {
        window.muya!.editor.scrollPage!.firstContentInDescendant().setCursor(o, o, true);
    }, offset);
    await expect.poll(() => caretOffset(page)).toBe(offset);
}

async function tapArrowRight(page: Page, times: number) {
    for (let i = 0; i < times; i++)
        await page.keyboard.press('ArrowRight');
}

test.describe('ArrowRight steps over an inline preview', () => {
    // `$`(16) `x = 3`(17-22) `$`(22-23) ` which…`(23-)
    const MATH = 'the equation is $x = 3$ which draws a line';

    test('leaves inline math past the closing `$`', async ({ page }) => {
        await placeCaret(page, MATH, 21);

        await tapArrowRight(page, 3);

        await expect.poll(() => caretOffset(page)).toBe(24);
        await expect(page.locator(`${editor.paragraph} span.mu-math-marker.mu-hide`)).toHaveCount(2);
    });

    test('moves one character per press at the closing `$`', async ({ page }) => {
        await placeCaret(page, MATH, 22);

        await tapArrowRight(page, 1);

        await expect.poll(() => caretOffset(page)).toBe(23);
    });

    test('leaves inline ruby', async ({ page }) => {
        const ruby = '<ruby>漢<rt>kan</rt></ruby>';
        await placeCaret(page, `a ${ruby} b`, 2 + ruby.length);

        await tapArrowRight(page, 1);

        await expect.poll(() => caretOffset(page)).toBe(2 + ruby.length + 1);
    });
});
