import type { IMuyaOptions } from '@muyajs/core';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

/**
 * Auto-pair option matrix.
 *
 * Behaviour we exercise (from `packages/core/src/block/base/content.ts`):
 *   - `autoPairBracket`     — typing `(`, `[`, `{` inserts the matching close
 *     when the cursor is at end-of-line or before whitespace.
 *   - `autoPairMarkdownSyntax` — typing `*`, `_`, `` ` ``, `$`, `~` pairs the marker.
 *   - `autoPairQuote`       — typing `"` (or `'` after non-word) pairs the quote.
 *
 * For each (option-on, option-off) variant we rebuild Muya via the host
 * helper `window.__e2e.rebuildMuya(...)` so the constructor option is
 * actually consumed (the option is read inside autoPair from
 * `this.muya.options`, captured at constructor time).
 */

/**
 * Rebuild Muya with the given options and place the cursor in a fresh
 * empty paragraph, ready for keyboard input.
 *
 * The naive approach (`paragraph.click()` + wait for
 * `activeContentBlock != null`) fails on headless Chromium-for-Testing:
 * clicking an *empty* `.mu-paragraph` lands the browser selection
 * anchor on the paragraph element itself rather than on a text node,
 * so muya's `selection.getSelection()` returns null/no-anchor and the
 * editor dispatch explicitly sets `activeContentBlock = null` and
 * returns (editor/index.ts ~line 99). The wait then times out.
 *
 * Robust alternative: drive the cursor through muya's own API
 * (`muya.focus()` → `firstLeafBlock.setCursor(0, 0, …)`), which
 * positions a real selection inside the leaf content. Then call
 * `.focus()` on the contenteditable container so DOM focus is on
 * the editor and subsequent `page.keyboard.type(...)` events route
 * through muya's input handler.
 */
async function rebuildAndFocus(page: Page, opts: Partial<IMuyaOptions>): Promise<void> {
    await page.evaluate((o) => {
        window.__e2e!.rebuildMuya(o);
        window.muya!.setContent('');
        window.muya!.focus();
        window.muya!.domNode.focus();
    }, opts);
    await expect(page.locator(editor.paragraph).first()).toBeVisible();
}

async function getFirstBlockText(page: Page): Promise<string> {
    return page.evaluate(() => {
        const state = window.muya!.getState() as Array<{ text?: string }>;
        return state[0]?.text ?? '';
    });
}

async function setContentAndSelect(
    page: Page,
    initial: string,
    start: number,
    end: number,
): Promise<void> {
    await page.evaluate(({ initial, start, end }) => {
        window.muya!.setContent(initial);
        window.muya!.focus();
        window.muya!.domNode.focus();
        const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(start, end, true);
    }, { initial, start, end });

    const selectedText = initial.slice(start, end);
    await expect.poll(() => page.evaluate(() => {
        const live = window.muya!.editor.selection.getSelection();
        const native = window.getSelection();
        return {
            anchorOffset: live?.anchor.offset ?? null,
            focusOffset: live?.focus.offset ?? null,
            selectedText: native?.toString() ?? '',
        };
    })).toEqual({
        anchorOffset: start,
        focusOffset: end,
        selectedText,
    });
}

async function expectSelectedText(
    page: Page,
    selectedText: string,
    start: number,
    end: number,
): Promise<void> {
    await expect.poll(() => page.evaluate(() => {
        const live = window.muya!.editor.selection.getSelection();
        const native = window.getSelection();
        return {
            anchorOffset: live?.anchor.offset ?? null,
            focusOffset: live?.focus.offset ?? null,
            selectedText: native?.toString() ?? '',
        };
    })).toEqual({
        anchorOffset: start,
        focusOffset: end,
        selectedText,
    });
}

test.describe('options / auto-pair matrix', () => {
    test('autoPairBracket: on → `(` produces `()`', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: true,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        });
        await page.keyboard.type('(');
        await expect(page.locator(editor.paragraph).first()).toContainText('()');
        const md = await getMarkdown(page);
        expect(md).toContain('()');
    });

    test('autoPairBracket: off → `(` produces `(` only', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        });
        await page.keyboard.type('(');
        await expect(page.locator(editor.paragraph).first()).toContainText('(');
        expect(await getFirstBlockText(page)).toBe('(');
    });

    test('autoPairMarkdownSyntax: on → `*` produces `**`', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: true,
            autoPairQuote: false,
        });
        await page.keyboard.type('*');
        // Wait for state to reflect the paired insertion.
        await expect.poll(() => getFirstBlockText(page)).toBe('**');
    });

    test('autoPairMarkdownSyntax: off → `*` stays single', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        });
        await page.keyboard.type('*');
        await expect.poll(() => getFirstBlockText(page)).toBe('*');
    });

    test('autoPairQuote: on → `"` produces `""`', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: true,
        });
        await page.keyboard.type('"');
        await expect.poll(() => getFirstBlockText(page)).toBe('""');
    });

    test('autoPairQuote: off → `"` stays single', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        });
        await page.keyboard.type('"');
        await expect.poll(() => getFirstBlockText(page)).toBe('"');
    });

    test('all-off combo: no pairing happens for any of `(`, `*`, `"`', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        });
        await page.keyboard.type('(');
        await expect.poll(() => getFirstBlockText(page)).toBe('(');

        // Reset paragraph and re-focus for the next char. Same caveat as
        // rebuildAndFocus: drive focus via muya's API + domNode.focus()
        // because clicking an empty paragraph doesn't establish a
        // text-node selection in headless Chromium.
        await page.evaluate(() => {
            window.muya!.setContent('');
            window.muya!.focus();
            window.muya!.domNode.focus();
        });
        await page.keyboard.type('*');
        await expect.poll(() => getFirstBlockText(page)).toBe('*');

        await page.evaluate(() => {
            window.muya!.setContent('');
            window.muya!.focus();
            window.muya!.domNode.focus();
        });
        await page.keyboard.type('"');
        await expect.poll(() => getFirstBlockText(page)).toBe('"');
    });

    test('typing an auto-pair character over a selection wraps the selected text', async ({ page }) => {
        await rebuildAndFocus(page, {
            autoPairBracket: true,
            autoPairMarkdownSyntax: true,
            autoPairQuote: true,
        });

        await setContentAndSelect(page, 'hello world', 0, 5);
        await page.keyboard.type('(');
        await expect.poll(() => getFirstBlockText(page)).toBe('(hello) world');
        await expectSelectedText(page, 'hello', 1, 6);

        await setContentAndSelect(page, 'hello world', 0, 11);
        await page.keyboard.type('"');
        await expect.poll(() => getFirstBlockText(page)).toBe('"hello world"');
        await expectSelectedText(page, 'hello world', 1, 12);

        await setContentAndSelect(page, 'hello world', 0, 5);
        await page.keyboard.type('*');
        await expect.poll(() => getFirstBlockText(page)).toBe('*hello* world');
        await expectSelectedText(page, 'hello', 1, 6);

        await setContentAndSelect(page, 'hello world', 0, 5);
        await page.keyboard.type('`');
        await expect.poll(() => getFirstBlockText(page)).toBe('`hello` world');
        await expectSelectedText(page, 'hello', 1, 6);

        await setContentAndSelect(page, '中文文本', 0, 4);
        await page.keyboard.type('"');
        await expect.poll(() => getFirstBlockText(page)).toBe('"中文文本"');
        await expectSelectedText(page, '中文文本', 1, 5);
    });
});
