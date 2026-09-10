import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('slash quick-insert menu', () => {
    test('typing `/` opens the menu', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
    });

    test('typing a search term filters menu items', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await slowType(page, 'head');
        // After filtering for "head", the atx-heading items remain visible.
        const headingItem = page.locator(quickInsertItem('atx-heading 1'));
        await expect(headingItem).toBeVisible();
    });

    test('clicking a menu item inserts the block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('atx-heading 2')).click();
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
    });

    test('highlight follows the active mouse or keyboard input', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');

        const menu = page.locator(floats.quickInsert);
        const heading1 = page.locator(quickInsertItem('atx-heading 1'));
        await heading1.hover();

        const pointerBackgrounds = await page.evaluate(() => {
            const paragraph = document.querySelector<HTMLElement>('[data-label="paragraph"]');
            const heading1 = document.querySelector<HTMLElement>('[data-label="atx-heading 1"]');
            return {
                paragraph: paragraph && getComputedStyle(paragraph).backgroundColor,
                heading1: heading1 && getComputedStyle(heading1).backgroundColor,
            };
        });
        expect(pointerBackgrounds.heading1).not.toBe(pointerBackgrounds.paragraph);

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        await expect(menu).toHaveClass(/mu-keyboard-navigation/);
        await expect(page.locator(quickInsertItem('atx-heading 3'))).toHaveClass(/active/);
        const keyboardBackgrounds = await page.evaluate(() => {
            const heading1 = document.querySelector<HTMLElement>('[data-label="atx-heading 1"]');
            const heading3 = document.querySelector<HTMLElement>('[data-label="atx-heading 3"]');
            return {
                heading1: heading1 && getComputedStyle(heading1).backgroundColor,
                heading3: heading3 && getComputedStyle(heading3).backgroundColor,
            };
        });
        expect(keyboardBackgrounds.heading3).not.toBe(keyboardBackgrounds.heading1);

        await page.keyboard.press('Enter');
        await expect(page.locator('h3.mu-atx-heading').first()).toBeVisible();
    });

    // EXTEND item 1a — Enter-select inserts a block (keyboard, not click).
    // Typing `/` then narrowing with `quote` filters the menu so `block-quote`
    // becomes the active item (fuse top match); BaseScrollFloat's keydown
    // handler maps Enter -> selectItem(activeItem), which runs
    // replaceBlockByLabel and converts the active paragraph in place.
    test('narrowing then pressing Enter converts the paragraph to the active block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await slowType(page, 'quote');
        // Wait until the fuse-filtered top match (Quote Block) is the active item.
        await page.waitForFunction(() => {
            const active = document.querySelector('.mu-quick-insert .item.active');
            return active?.getAttribute('data-label') === 'block-quote';
        });
        await page.keyboard.press('Enter');
        // The active paragraph converts to a block-quote in place.
        await expect(page.locator(editor.blockQuote).first()).toBeVisible();
        // Markdown serialization is async after the in-place replace — poll it.
        await expect.poll(() => getMarkdown(page)).toMatch(/^\s*>/);
    });

    // EXTEND item 1b — front-matter is top-only gated.
    // `checkCanInsertFrontMatter` requires `frontMatter` (on by default) AND
    // the trigger block to have no previous sibling under the scroll page;
    // `search()` splices the "Front Matter" entry out otherwise. So the entry
    // is present on the document's first block and absent on a lower block.
    test('front-matter entry is available on the first block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.waitForFunction(() => {
            const el = document.querySelector('.mu-quick-insert');
            return !!el && el.querySelectorAll('.item').length > 0;
        });
        await expect(page.locator(quickInsertItem('frontmatter'))).toBeVisible();
    });

    test('front-matter entry is absent on a non-first block', async ({ page }) => {
        // Heading + Enter yields an empty paragraph as the SECOND block, whose
        // parent has a previous sibling (the heading) — front-matter gating off.
        await page.evaluate(() => window.muya!.setContent('# heading'));
        await page.locator(editor.atxHeading).first().click();
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.waitForFunction(() => {
            const el = document.querySelector('.mu-quick-insert');
            return !!el && el.querySelectorAll('.item').length > 0;
        });
        // Other entries still render (sanity), but front-matter is spliced out.
        await expect(page.locator(quickInsertItem('paragraph'))).toBeVisible();
        await expect(page.locator(quickInsertItem('frontmatter'))).toHaveCount(0);
    });

    // EXTEND item 2 — the full-width Chinese ideographic comma `、` is wired as
    // an alternate trigger alongside `/` (checkQuickInsert: /^[/、]\S*$/).
    test('typing the full-width `、` opens the quick-insert menu', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.insertText('、');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.waitForFunction(() => {
            const el = document.querySelector('.mu-quick-insert');
            return !!el && el.querySelectorAll('.item').length > 0;
        });
        // The menu offers the same entries as the `/` trigger.
        await expect(page.locator(quickInsertItem('atx-heading 1'))).toBeVisible();
    });
});
