import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';
import { expectTreeMatchesJson } from '../helpers/tree';

const DOC = 'Hello world\n\nFoo bar\n';

async function selectAcrossParagraphs(page: Page): Promise<void> {
    await loadMarkdown(page, DOC);
    await page.locator(editor.paragraph).first().click();
    const sameBlock = await page.evaluate((selector) => {
        const paragraphs = document.querySelectorAll(selector);
        const textNode = (element: Element) => document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
        const range = document.createRange();
        range.setStart(textNode(paragraphs[0]), 6);
        range.setEnd(textNode(paragraphs[1]), 3);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        return window.muya!.editor.selection.getTextSelection()?.isSelectionInSameBlock;
    }, editor.paragraphContent);
    expect(sameBlock).toBe(false);
}

test.describe('non-editing keys over a cross-block selection (#5900)', () => {
    for (const key of ['Home', 'End', 'PageUp', 'PageDown', 'F6', 'NumLock']) {
        test(`${key} preserves the document`, async ({ page }) => {
            await selectAcrossParagraphs(page);

            await page.keyboard.press(key);

            await expect.poll(() => getMarkdown(page)).toBe(DOC);
            await expectTreeMatchesJson(page);
        });
    }

    test('an unidentified ThinkPad Fn event preserves the document and selection', async ({ page }) => {
        await selectAcrossParagraphs(page);

        // Fn is hardware-dependent; replay the Chromium event reported in #5900.
        const result = await page.evaluate(() => {
            const event = new KeyboardEvent('keydown', {
                key: 'Unidentified',
                code: 'WakeUp',
                keyCode: 255,
                bubbles: true,
                cancelable: true,
            });
            const allowed = document.activeElement!.dispatchEvent(event);
            return { allowed, selection: window.getSelection()!.toString() };
        });

        expect(result).toEqual({ allowed: true, selection: 'world\n\nFoo' });
        await expect.poll(() => getMarkdown(page)).toBe(DOC);
        await expectTreeMatchesJson(page);
    });

    for (const key of ['Backspace', 'Delete']) {
        test(`${key} still removes the selected text`, async ({ page }) => {
            await selectAcrossParagraphs(page);

            await page.keyboard.press(key);

            await expect.poll(() => getMarkdown(page)).toBe('Hello  bar\n');
            await expectTreeMatchesJson(page);
        });
    }
});
