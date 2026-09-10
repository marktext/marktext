import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// #5282 — a trailing soft line break rendered one blank line too many until
// something was typed on the new line, so the content below the paragraph
// jumped down and back again.
//
// The quick-insert hint's `::after` took `content: attr(placeholder)` from a
// selector that did not require the attribute, so outside the quick-insert
// menu it generated an empty box that still took part in layout. A block
// ending in a soft line break ends with a block-level `mu-line-end` span,
// which that inline box cannot share a line with, so it claimed one of its own.
//
// Heights are compared against each other rather than against pixel constants:
// what the bug did was add a line, and only the ratio between the states says
// whether it is back.

async function paragraphHeight(page: Page): Promise<number> {
    return page.evaluate(
        selector => document.querySelector(selector)!.getBoundingClientRect().height,
        editor.paragraph,
    );
}

test.describe('height of a paragraph ending in a soft line break', () => {
    test('a trailing soft line break adds exactly one line', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.insertText('第一行');
        const oneLine = await paragraphHeight(page);

        await page.keyboard.press('Shift+Enter');
        await expect(page.locator(editor.softLineBreak)).toHaveCount(1);
        const withBreak = await paragraphHeight(page);

        // The caret now sits on an empty second line. Typing there must not
        // change the height — before the fix the paragraph shrank by a line as
        // soon as the first character landed.
        await page.keyboard.insertText('a');
        await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toBe('第一行\na\n');
        const twoLines = await paragraphHeight(page);

        expect(withBreak).toBeCloseTo(twoLines, 0);
        expect(withBreak / oneLine).toBeGreaterThan(1.5);
        expect(withBreak / oneLine).toBeLessThan(2.5);
    });

    test('the quick-insert hints still render', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();

        // Empty paragraph: the `empty-hint` rule, which the fix must not touch.
        await expect
            .poll(() => page.evaluate(
                selector => globalThis.getComputedStyle(document.querySelector(selector)!, '::after').content,
                editor.paragraphContent,
            ))
            .toContain('/');

        // Quick-insert menu open: `placeholder` is set, so the gated rule applies.
        await page.keyboard.type('/', { delay: 60 });
        await expect
            .poll(() => page.evaluate(
                selector => document.querySelector(selector)!.getAttribute('placeholder'),
                editor.paragraphContent,
            ))
            .not.toBeNull();
        await expect
            .poll(() => page.evaluate(
                selector => globalThis.getComputedStyle(document.querySelector(selector)!, '::after').content,
                editor.paragraphContent,
            ))
            .not.toBe('none');
    });
});
