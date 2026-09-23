import type { Page } from '@playwright/test';
import process from 'node:process';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';
import {
    collectPageErrors,
    detachedBlocks,
    enterTwiceAtEndOfList,
    expectTreeMatchesJson,
    nextFrames,
} from '../helpers/tree';

const DOC = '- one\n- two\n\ntext\n';

const isMac = process.platform === 'darwin';

async function caretAt(page: Page, selector: string, nth: number, offset: number) {
    return page.evaluate(({ selector, nth, offset }) => {
        const el = document.querySelectorAll(selector)[nth] as HTMLElement;
        const text = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
        const range = document.createRange();
        range.setStart(text, offset);
        range.setEnd(text, offset);
        const rect = range.getBoundingClientRect();
        return { x: rect.left, y: rect.top + rect.height / 2 };
    }, { selector, nth, offset });
}

const BULLET_TEXT = `${editor.listItem} ${editor.paragraphContent}`;
const PARAGRAPH_TEXT = `${editor.paragraph}:not(${editor.listItem} ${editor.paragraph}) ${editor.paragraphContent}`;

async function selectFromBulletIntoParagraph(page: Page): Promise<void> {
    const start = await caretAt(page, BULLET_TEXT, 1, 2);
    const end = await caretAt(page, PARAGRAPH_TEXT, 0, 2);

    await page.mouse.click(start.x, start.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(end.x, end.y);
    await page.keyboard.up('Shift');
    await nextFrames(page);
}

async function expectClean(page: Page, errors: string[], markdown: string): Promise<void> {
    expect.soft(await detachedBlocks(page)).toEqual([]);
    await expect.soft.poll(() => getMarkdown(page)).toBe(markdown);

    await enterTwiceAtEndOfList(page);

    expect(errors).toEqual([]);
    expect(await detachedBlocks(page)).toEqual([]);
    await expectTreeMatchesJson(page);
}

const DELETE_CHORDS = [
    'Control+Backspace',
    ...(isMac ? ['Meta+Backspace', 'Control+k', 'Control+d', 'Control+h'] : []),
];

for (const chord of DELETE_CHORDS) {
    test(`${chord} over a selection spanning two blocks deletes it from the document (#5415)`, async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, DOC);
        await nextFrames(page);
        await selectFromBulletIntoParagraph(page);

        await page.keyboard.press(chord);
        await nextFrames(page);

        await expectClean(page, errors, '- one\n- twxt\n');
    });
}

test('Ctrl+Y over a selection spanning two blocks replaces it with the yanked text (#5415)', async ({ page }) => {
    test.skip(!isMac, 'yank: is a macOS-only editing command');

    const errors = collectPageErrors(page);
    await loadMarkdown(page, DOC);
    await nextFrames(page);

    const paragraphStart = await caretAt(page, PARAGRAPH_TEXT, 0, 0);
    await page.mouse.click(paragraphStart.x, paragraphStart.y);
    await page.keyboard.press('Control+k');
    await nextFrames(page);

    await loadMarkdown(page, DOC);
    await nextFrames(page);
    await selectFromBulletIntoParagraph(page);

    await page.keyboard.press('Control+y');
    await nextFrames(page);

    await expectClean(page, errors, '- one\n- twtextxt\n');
});

test('Ctrl+C over a selection spanning two blocks still does not delete it (#3491)', async ({ page }) => {
    await loadMarkdown(page, DOC);
    await nextFrames(page);
    await selectFromBulletIntoParagraph(page);

    await page.keyboard.press('Control+c');
    await nextFrames(page);

    await expect.poll(() => getMarkdown(page)).toBe(DOC);
});

test('typing a printable character over a selection spanning two blocks replaces it', async ({ page }) => {
    await loadMarkdown(page, DOC);
    await nextFrames(page);
    await selectFromBulletIntoParagraph(page);

    await page.keyboard.press('z');
    await nextFrames(page);

    expect(await detachedBlocks(page)).toEqual([]);
    await expect.poll(() => getMarkdown(page)).toBe('- one\n- twzxt\n');
});
