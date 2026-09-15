import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown, metaKey } from '../helpers/keyboard';

// #5035 / #5127: Enter, Enter at the end of a bullet list threw "Failed to
// execute 'insertBefore' on 'Node'" because the block after the list was still
// in the block tree while the browser had already removed its DOM node.
//
// The browser removed it while editing a selection that spans blocks on its
// own. Muya cuts such a selection on keydown, but that keydown cut never runs
// for text committed without a keydown (an emoji picker commit) or for a
// deletion bound to a Cmd/Ctrl shortcut.

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

async function selectBetween(page: Page, anchorText: string, anchorOffset: number, focusText: string, focusOffset: number): Promise<void> {
    await page.evaluate(({ anchorText, anchorOffset, focusText, focusOffset }) => {
        const { scrollPage, selection } = window.muya!.editor;
        const find = (text: string) => {
            let block = scrollPage!.firstContentInDescendant();
            while (block && block.text !== text)
                block = block.nextContentInContext() ?? null;
            return block!;
        };
        const anchor = find(anchorText);
        const focus = find(focusText);
        selection.setSelection(
            { offset: anchorOffset, block: anchor, path: anchor.path },
            { offset: focusOffset, block: focus, path: focus.path },
        );
    }, { anchorText, anchorOffset, focusText, focusOffset });
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

async function placeCaretAtEnd(page: Page, text: string): Promise<void> {
    await page.evaluate((text) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        block!.setCursor(text.length, text.length, true);
    }, text);
}

async function pressEnterTwice(page: Page): Promise<void> {
    await page.keyboard.press('Enter');
    await nextFrames(page);
    await page.keyboard.press('Enter');
    await nextFrames(page);
}

test.describe('native edits over a selection that spans blocks (#5035)', () => {
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'Relies on Chromium applying a selection change made in beforeinput; WebKit edits the range it captured before the event',
    );

    test('text committed without a key press over a selection from a list item into the next paragraph', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- one\n- two\n\ntext\n');
        await nextFrames(page);
        await selectBetween(page, 'two', 2, 'text', 2);

        await page.keyboard.insertText('é');
        await nextFrames(page);

        expect.soft(await detachedBlocks(page)).toEqual([]);
        await expect.soft.poll(() => getMarkdown(page)).toBe('- one\n- twéxt\n');

        await placeCaretAtEnd(page, 'twéxt');
        await pressEnterTwice(page);

        expect(errors).toEqual([]);
        expect(await detachedBlocks(page)).toEqual([]);
        await expect.poll(() => getMarkdown(page)).toBe('- one\n- twéxt\n\n\n');
        await expectTreeMatchesJson(page);
    });

    test('a Cmd/Ctrl deletion shortcut over a selection from a list item into the next paragraph', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadMarkdown(page, '- one\n- two\n\ntext\n');
        await nextFrames(page);
        await selectBetween(page, 'two', 2, 'text', 2);

        await page.keyboard.press(`${metaKey()}+Backspace`);
        await nextFrames(page);

        expect.soft(await detachedBlocks(page)).toEqual([]);
        await expect.soft.poll(() => getMarkdown(page)).toBe('- one\n- twxt\n');

        await placeCaretAtEnd(page, 'twxt');
        await pressEnterTwice(page);

        expect(errors).toEqual([]);
        expect(await detachedBlocks(page)).toEqual([]);
        await expect.poll(() => getMarkdown(page)).toBe('- one\n- twxt\n\n\n');
        await expectTreeMatchesJson(page);
    });
});
