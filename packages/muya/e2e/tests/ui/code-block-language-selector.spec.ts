import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats } from '../helpers/selectors';

// CodeBlockLanguageSelector (plugin name 'codePicker', float root
// `.mu-list-picker`) is registered in the host (host/main.ts Muya.use).
// It listens for `content-change` on `language-input` / `paragraph.content`
// blocks, runs a fuse.js search over the prism language list (keys
// name/title/alias) and renders the top-5 matches as `li.item[data-label]`
// rows. Clicking a row applies that language to the code block.
//
// The matches below were confirmed against the live fuse index:
//   'pyth' -> python, py, rpy, renpy, uscript   (top: python)
// Source of truth: src/ui/codeBlockLanguageSelector/index.ts +
// src/utils/prism/index.ts (search()).

// A code block renders a `.mu-language-input` row nested inside its `<pre>`;
// the `<pre>` intercepts pointer events at the input's center, so a plain
// Playwright click is unreliable. Focus the language-input the way the engine
// does — by placing the caret in its content block via setCursor — then real
// keystrokes land in the input and drive the `content-change` pipeline.
// (muya keeps a single contenteditable root, so DOM focus stays on
// `.mu-editor`; the editor's `activeContentBlock` is the real focus target.)
async function focusFirstLanguageInput(page: Page): Promise<void> {
    await page.evaluate(() => {
        const codeBlock = window.muya!.editor.scrollPage.firstChild;
        codeBlock.firstContentInDescendant().setCursor(0, 0, true);
    });
    await expect
        .poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.blockName))
        .toBe('language-input');
}

test.describe('code-block language selector', () => {
    test('typing a fuzzy query in the language input opens the picker', async ({ page }) => {
        // A fenced code block renders a `.mu-language-input` row; focusing it
        // and typing emits `content-change` for the language-input block.
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        await expect(page.locator(floats.codeBlockLanguageSelector)).toBeVisible();
    });

    test('the picker lists fuzzy-matching language items', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        const picker = page.locator(floats.codeBlockLanguageSelector);
        await expect(picker).toBeVisible();
        // fuse returns up to 5 matches; each is an `li.item` carrying the
        // language name as both `data-label` and `.language` text.
        const items = picker.locator('li.item');
        await expect(items.first()).toBeVisible();
        const count = await items.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(5);
        // 'python' is among the matches for the 'pyth' query.
        await expect(picker.locator('li.item[data-label="python"]')).toHaveCount(1);
    });

    test('each item carries its language label as data-label and text', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        const python = page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="python"]`);
        await expect(python).toBeVisible();
        // The visible row text comes from the `div.language` child.
        await expect(python.locator('.language')).toHaveText('python');
    });

    test('clicking a language item applies it to the language input', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        await page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="python"]`).click();
        // selectItem sets `block.text = name`, so the language input now reads
        // 'python'.
        await expect(page.locator(editor.languageInput).first()).toHaveText('python');
    });

    test('clicking a language item updates the serialized markdown fence', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        await page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="python"]`).click();
        // The fenced block serializes with the chosen language tag. Markdown
        // serialization is async after the in-place update — poll it.
        await expect.poll(() => getMarkdown(page)).toContain('```python');
    });

    test('the picker hides when the query no longer matches any language', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        await expect(page.locator(floats.codeBlockLanguageSelector)).toBeVisible();
        // Clearing the input emits a `content-change` with an empty lang;
        // `search('')` returns no modes so the selector calls `hide()`.
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        // baseFloat.hide() parks the wrapper off-screen (top:-9999px, opacity:0)
        // rather than toggling display/visibility, so `toBeVisible()` still
        // reports true — assert the off-screen park instead.
        const wrapper = page
            .locator(floats.codeBlockLanguageSelector)
            .locator('xpath=ancestor::*[contains(@class,"mu-float-wrapper")]');
        await expect
            .poll(() => wrapper.evaluate(el => (el as HTMLElement).style.opacity))
            .toBe('0');
    });

    test('the picker hides when the caret leaves the language input', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusFirstLanguageInput(page);
        await slowType(page, 'pyth');
        await expect(page.locator(floats.codeBlockLanguageSelector)).toBeVisible();
        // Moving the caret out of the language-input (as Left/Right arrow does)
        // emits a `selection-change` whose anchorBlock is no longer the picker's
        // target, so the selector self-hides (#4654).
        await page.evaluate(() => {
            const langInput = window.muya!.editor.activeContentBlock;
            langInput.parent.lastContentInDescendant().setCursor(0, 0, true);
        });
        const wrapper = page
            .locator(floats.codeBlockLanguageSelector)
            .locator('xpath=ancestor::*[contains(@class,"mu-float-wrapper")]');
        await expect
            .poll(() => wrapper.evaluate(el => (el as HTMLElement).style.opacity))
            .toBe('0');
    });

    test('typing the opening fence in a paragraph opens the picker', async ({ page }) => {
        // The selector also listens on `paragraph.content`: a fence prefix like
        // ```pyth in a plain paragraph is parsed for the language token and
        // drives the same fuse search.
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '```pyth');
        const picker = page.locator(floats.codeBlockLanguageSelector);
        await expect(picker).toBeVisible();
        await expect(picker.locator('li.item[data-label="python"]')).toHaveCount(1);
    });

    test('selecting from the paragraph fence picker creates a fenced code block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '```pyth');
        await page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="python"]`).click();
        // On a paragraph.content block selectItem replaces the paragraph with a
        // freshly-created code-block (state.name === 'code-block').
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();
        await expect(page.locator(editor.languageInput).first()).toHaveText('python');
        await expect.poll(() => getMarkdown(page)).toContain('```python');
    });
});
