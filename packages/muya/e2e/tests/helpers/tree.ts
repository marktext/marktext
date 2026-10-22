import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

export async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

/** Block names whose `domNode` the browser detached behind muya's back. */
export async function detachedBlocks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const detached: string[] = [];
        window.muya!.editor.scrollPage!.depthFirstTraverse((block) => {
            if (!block.domNode?.isConnected)
                detached.push(block.blockName);
        });
        return detached;
    });
}

export async function expectTreeMatchesJson(page: Page): Promise<void> {
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

/**
 * Seat the caret at the end of the last list item, then press Enter twice —
 * the edit that throws `insertBefore` once a detached block is in the tree.
 */
export async function enterTwiceAtEndOfList(page: Page): Promise<void> {
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
}
