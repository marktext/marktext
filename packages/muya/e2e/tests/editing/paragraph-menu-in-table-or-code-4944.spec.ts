import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #4944: a paragraph command (Heading 1 from the command palette, Insert
// Paragraph, Insert Table) run with the caret in a table cell or in a code
// block put the new block inside the table row or the code block. The json
// flush then threw "Cannot use numerical key for object container" and kept
// throwing on every later edit, so nothing else reached the saved markdown.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function placeCaretAtEnd(page: Page, blockName: string, text: string): Promise<void> {
    await page.evaluate(({ blockName, text }) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && !(block.blockName === blockName && block.text === text))
            block = block.nextContentInContext() ?? null;
        block!.setCursor(text.length, text.length, true);
    }, { blockName, text });
}

test.describe('paragraph commands with the caret in a table or code block (#4944)', () => {
    test('in a table cell they leave the table intact and editing keeps working', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
        await nextFrames(page);

        await placeCaretAtEnd(page, 'table.cell.content', '2');
        await page.evaluate(() => {
            window.muya!.updateParagraph('heading 1');
            window.muya!.insertParagraph('after');
        });
        await page.keyboard.type('below');
        await expect.poll(() => getMarkdown(page)).toBe('| a   | b   |\n| --- | --- |\n| 1   | 2   |\n\nbelow\n');
        expect(errors).toEqual([]);
    });

    test('in a code block they leave the code block intact and editing keeps working', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '```js\ncode\n```\n');
        await nextFrames(page);

        await placeCaretAtEnd(page, 'codeblock.content', 'code');
        await page.evaluate(() => {
            window.muya!.updateParagraph('heading 1');
            window.muya!.insertParagraph('before');
        });
        await page.keyboard.type('above');
        await expect.poll(() => getMarkdown(page)).toBe('above\n\n```js\ncode\n```\n');
        expect(errors).toEqual([]);
    });
});
