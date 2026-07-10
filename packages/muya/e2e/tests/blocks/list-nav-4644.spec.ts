import { expect, test } from '@playwright/test';
import { loadMarkdown, slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #4644 — a sequence of list edits used to leave a `list-item` with zero
// content children behind. An empty list item has no content descendant, so
// cross-block arrow navigation (`previousContentInContext`) could not step
// over it and Up arrow stopped moving the caret up a line.
//
// Repro sequence: * [space] A [return] B [up] [return] [backspace] [up]
//                 [return] [return] [return]

// Index of the active content block among all `.content` leaves, plus the
// total content-block count — enough to tell whether the caret actually moved.
async function caretProbe(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const muya = window.muya!;
        const leaves: unknown[] = [];
        const visit = (block: {
            constructor: { blockName?: string };
            children?: { forEach: (cb: (b: unknown) => void) => void };
        }) => {
            if (block.constructor?.blockName?.endsWith('.content'))
                leaves.push(block);
            block.children?.forEach(b => visit(b as typeof block));
        };
        visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
        return {
            activeIndex: leaves.indexOf(muya.editor.activeContentBlock as unknown),
            leafCount: leaves.length,
        };
    });
}

async function runSequence(page: import('@playwright/test').Page) {
    await page.goto('/');
    await loadMarkdown(page, 'seed\n');
    const seed = page.locator(editor.paragraph).filter({ hasText: 'seed' }).first();
    await seed.click();
    await page.keyboard.press('End');
    for (let i = 0; i < 4; i++)
        await page.keyboard.press('Backspace');

    await slowType(page, '* ');
    await slowType(page, 'A');
    await page.keyboard.press('Enter');
    await slowType(page, 'B');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
}

test('list edit sequence never leaves an empty list item', async ({ page }) => {
    await runSequence(page);

    const hasEmptyListItem = await page.evaluate(() => {
        const state = window.muya!.getState();
        const found: boolean[] = [];
        const walk = (node: { name?: string; children?: unknown[] }) => {
            if (node.name === 'list-item' || node.name === 'task-list-item')
                found.push(!node.children || node.children.length === 0);
            node.children?.forEach(c => walk(c as typeof node));
        };
        state.forEach(n => walk(n as { name?: string; children?: unknown[] }));
        return found.some(Boolean);
    });

    expect(hasEmptyListItem).toBe(false);
});

test('Up arrow still moves the caret up after the list edit sequence', async ({ page }) => {
    await runSequence(page);

    const before = await caretProbe(page);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    const after = await caretProbe(page);

    // The caret must land on an earlier content block, not stay put.
    expect(after.activeIndex).toBeLessThan(before.activeIndex);
});
