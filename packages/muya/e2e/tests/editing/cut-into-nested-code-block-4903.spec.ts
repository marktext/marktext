import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #4903 / #5148: typing or Backspace over a selection that starts above a list
// or quote and ends inside a code, math or html block nested in it (with more
// content after that block) removed the wrong blocks from the json state. The
// json flush then threw "Cannot pick up or remove undefined" at once, or later
// edits hit "Cannot insert into out of bounds index", and nothing typed after
// that reached the saved markdown.

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

// Load, let the block previews and highlighting render (a re-render resets a
// DOM selection inside the block), then select from offset 2 of the first
// paragraph to `codeOffset` in the nested block's source.
async function loadAndSelectIntoNestedBlock(page: Page, markdown: string, codeOffset: number): Promise<void> {
    await loadMarkdown(page, markdown);
    await nextFrames(page);
    await page.waitForTimeout(150);
    await nextFrames(page);
    await page.evaluate((codeOffset) => {
        const { scrollPage, selection } = window.muya!.editor;
        const paragraph = scrollPage!.firstContentInDescendant()!;
        let code = paragraph.nextContentInContext();
        while (code && code.blockName !== 'codeblock.content')
            code = code.nextContentInContext() ?? null;
        selection.setSelection(
            { offset: 2, block: paragraph, path: paragraph.path },
            { offset: codeOffset, block: code!, path: code!.path },
        );
    }, codeOffset);
    await expect.poll(() => page.evaluate(() => {
        const selection = window.muya!.editor.selection.getSelection();
        return selection && `${selection.anchor.block.blockName}@${selection.anchor.offset} -> ${selection.focus.block.blockName}@${selection.focus.offset}`;
    })).toBe(`paragraph.content@2 -> codeblock.content@${codeOffset}`);
}

async function placeCaretAtEnd(page: Page, text: string): Promise<void> {
    await page.evaluate((text) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        block!.setCursor(text.length, text.length, true);
    }, text);
}

async function expectTreeMatchesJson(page: Page): Promise<void> {
    await nextFrames(page);
    const { tree, json } = await page.evaluate(() => {
        const muya = window.muya!;
        const blocks: unknown[] = [];
        muya.editor.scrollPage!.forEach((block) => {
            if (block.isParent())
                blocks.push(block.getState());
        });
        return { tree: blocks, json: muya.getState() };
    });
    expect(json).toEqual(tree);
}

test.describe('cross-block cut into a nested code, math or html block (#4903, #5148)', () => {
    test('typing over a selection into a math block in a quote', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadAndSelectIntoNestedBlock(page, 'intro\n\n> quote\n>\n> $$\n> a+b\n> $$\n>\n> tail\n', 1);

        await page.keyboard.type('X');
        await expect.poll(() => getMarkdown(page)).toBe('inX+b\n\n> tail\n');
        await expectTreeMatchesJson(page);

        await placeCaretAtEnd(page, 'tail');
        await page.keyboard.type('!');
        await expect.poll(() => getMarkdown(page)).toBe('inX+b\n\n> tail!\n');
        expect(errors).toEqual([]);
    });

    test('Backspace over a selection into a code block in a list item', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadAndSelectIntoNestedBlock(page, 'intro\n\n- item\n\n  ```js\n  code\n  ```\n\n  tail\n', 2);

        await page.keyboard.press('Backspace');
        await expect.poll(() => getMarkdown(page)).toBe('inde\n\n- tail\n');
        await expectTreeMatchesJson(page);

        await placeCaretAtEnd(page, 'tail');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Backspace');
        await expect.poll(() => getMarkdown(page)).toBe('inde\n\n- tail\n');
        await expectTreeMatchesJson(page);
        expect(errors).toEqual([]);
    });
});
