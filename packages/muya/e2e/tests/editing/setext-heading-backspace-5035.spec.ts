import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import {
    collectPageErrors,
    detachedBlocks,
    enterTwiceAtEndOfList,
    expectTreeMatchesJson,
    nextFrames,
} from '../helpers/tree';

// #5035: Backspace at the start of a setext heading turned it into a paragraph
// but let the browser's own Backspace run too. The browser merged that new
// paragraph into the bullet list above and removed its element, so the
// paragraph stayed in the block tree with a detached DOM node, and Enter,
// Enter at the end of the list threw "Failed to execute 'insertBefore' on
// 'Node'".

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

    await enterTwiceAtEndOfList(page);

    expect(errors).toEqual([]);
    expect(await detachedBlocks(page)).toEqual([]);
    await expect.poll(() => getMarkdown(page)).toBe('- one\n- two\n\n\n\nHeading\n');
    await expectTreeMatchesJson(page);
});
