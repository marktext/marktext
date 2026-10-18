import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { focusEditor, loadMarkdown } from '../helpers/keyboard';

// #3412: offsets come from muya's selection API; the column check uses the
// painted caret rect so it does not depend on exact glyph widths.

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function placeCaret(page: Page, blockIndex: number, offset: number): Promise<void> {
    await page.evaluate(({ blockIndex, offset }) => {
        const blocks: Array<{ setCursor: (begin: number, end: number, needUpdate?: boolean) => void }> = [];
        window.muya!.editor.scrollPage!.depthFirstTraverse((block) => {
            if (block.isContent())
                blocks.push(block);
        });
        blocks[blockIndex].setCursor(offset, offset, true);
    }, { blockIndex, offset });
    await nextFrames(page);
}

async function caret(page: Page): Promise<{ text: string | null; offset: number | null }> {
    return page.evaluate(() => {
        const selection = window.muya!.editor.selection;
        return {
            text: selection.anchorBlock?.text ?? null,
            offset: selection.anchor?.offset ?? null,
        };
    });
}

async function caretX(page: Page): Promise<number> {
    return page.evaluate(() => {
        const range = document.getSelection()!.getRangeAt(0).cloneRange();
        const rects = range.getClientRects();
        return (rects.length ? rects[0] : range.getBoundingClientRect()).x;
    });
}

test.describe('cross-block arrow keeps the caret column (#3412)', () => {
    test('arrowDown into a paragraph keeps the column instead of the start', async ({ page }) => {
        await loadMarkdown(page, 'aaaa bbbb cccc dddd\n\neeee ffff gggg hhhh\n');
        await focusEditor(page);
        await placeCaret(page, 0, 5);

        const before = await caretX(page);
        await page.keyboard.press('ArrowDown');
        await nextFrames(page);

        const after = await caret(page);
        expect(after.text).toBe('eeee ffff gggg hhhh');
        expect(after.offset ?? 0).toBeGreaterThan(0);
        expect(Math.abs((await caretX(page)) - before)).toBeLessThan(8);
    });

    test('arrowDown into a shorter paragraph clamps to its end', async ({ page }) => {
        await loadMarkdown(page, 'aaaa bbbb cccc dddd\n\nxy\n');
        await focusEditor(page);
        await placeCaret(page, 0, 10);

        await page.keyboard.press('ArrowDown');
        await nextFrames(page);

        const after = await caret(page);
        expect(after.text).toBe('xy');
        expect(after.offset).toBe(2);
    });

    test('arrowDown into a bullet list item keeps the column', async ({ page }) => {
        await loadMarkdown(page, 'aaaa bbbb cccc dddd\n\n- eeee ffff gggg\n');
        await focusEditor(page);
        await placeCaret(page, 0, 5);

        await page.keyboard.press('ArrowDown');
        await nextFrames(page);

        const after = await caret(page);
        expect(after.text).toBe('eeee ffff gggg');
        expect(after.offset ?? 0).toBeGreaterThan(0);
    });

    test('arrowUp into the previous paragraph keeps the column', async ({ page }) => {
        await loadMarkdown(page, 'aaaa bbbb cccc dddd\n\neeee ffff gggg hhhh\n');
        await focusEditor(page);
        await placeCaret(page, 1, 5);

        const before = await caretX(page);
        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        const after = await caret(page);
        expect(after.text).toBe('aaaa bbbb cccc dddd');
        expect(after.offset ?? 0).toBeGreaterThan(0);
        expect(after.offset ?? 0).toBeLessThan('aaaa bbbb cccc dddd'.length);
        expect(Math.abs((await caretX(page)) - before)).toBeLessThan(8);
    });

    // Inline markers are part of the block's offset space but not its painted
    // width, so a formatted neighbour is the case most likely to mis-resolve.
    test('arrowDown into a bold paragraph keeps the column', async ({ page }) => {
        await loadMarkdown(page, 'aaaa bbbb cccc dddd\n\n**eeee** ffff gggg\n');
        await focusEditor(page);
        await placeCaret(page, 0, 5);

        await page.keyboard.press('ArrowDown');
        await nextFrames(page);

        const after = await caret(page);
        expect(after.text).toContain('eeee');
        expect(after.offset ?? 0).toBeGreaterThan(0);
    });
});
