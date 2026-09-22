import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5035: Backspace at the start of a setext heading turned it into a paragraph
// but let the browser's own Backspace run too. The browser merged that new
// paragraph into the bullet list above and removed its element, so the
// paragraph stayed in the block tree with a detached DOM node, and Enter,
// Enter at the end of the list threw "Failed to execute 'insertBefore' on
// 'Node'".

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

async function detachedBlocks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const detached: string[] = [];
        window.muya!.editor.scrollPage!.depthFirstTraverse((block) => {
            if (!block.domNode?.isConnected)
                detached.push(block.blockName);
        });
        return detached;
    });
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

test('Backspace at the start of a setext heading below a bullet list, then Enter twice on the list (#5035)', async ({ page }) => {
    const errors = collectPageErrors(page);
    await loadMarkdown(page, '- one\n- two\n\nHeading\n---\n');
    await nextFrames(page);

    const start = await page.evaluate(() => {
        const heading = document.querySelector('.mu-setextheading-content')!;
        const rect = heading.getBoundingClientRect();
        return { x: rect.left + 1, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(start.x, start.y);
    await page.keyboard.press('Home');
    await page.keyboard.press('Backspace');
    await nextFrames(page);

    expect.soft(await detachedBlocks(page)).toEqual([]);
    await expect.soft.poll(() => getMarkdown(page)).toBe('- one\n- two\n\nHeading\n');

    await page.evaluate(() => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        let lastInList = block;
        while (block) {
            if (block.closestBlock('list-item'))
                lastInList = block;
            block = block.nextContentInContext() ?? null;
        }
        const end = lastInList!.text.length;
        lastInList!.setCursor(end, end, true);
    });
    await page.keyboard.press('Enter');
    await nextFrames(page);
    await page.keyboard.press('Enter');
    await nextFrames(page);

    expect(errors).toEqual([]);
    expect(await detachedBlocks(page)).toEqual([]);
    await expect.poll(() => getMarkdown(page)).toBe('- one\n- two\n\n\n\nHeading\n');
    await expectTreeMatchesJson(page);
});
