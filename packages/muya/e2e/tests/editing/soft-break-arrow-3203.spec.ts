import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
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

async function seedTrailingSoftBreak(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.muya!.setContent([
            { name: 'paragraph', text: '' },
            { name: 'paragraph', text: 'test\n' },
        ]);
    });
    await expect(page.locator(editor.softLineBreak)).toHaveCount(1);
}

const BLANK_LINE = 'test\n'.length;

test.describe('caret navigation around a trailing soft line break (#3203)', () => {
    test('ArrowUp from the blank line moves up one line, not to the previous block', async ({ page }) => {
        await seedTrailingSoftBreak(page);
        await placeCaret(page, 1, BLANK_LINE);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        expect(await caret(page)).toMatchObject({ text: 'test\n', offset: 0 });
    });

    test('repeated ArrowUp walks up one visual line at a time', async ({ page }) => {
        await seedTrailingSoftBreak(page);
        await placeCaret(page, 1, BLANK_LINE);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);
        expect(await caret(page)).toMatchObject({ text: 'test\n', offset: 0 });

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);
        expect(await caret(page)).toMatchObject({ text: '', offset: 0 });
    });

    test('ArrowDown steps onto the blank line, and ArrowUp returns to it', async ({ page }) => {
        await seedTrailingSoftBreak(page);
        await placeCaret(page, 1, 0);

        await page.keyboard.press('ArrowDown');
        await nextFrames(page);
        expect(await caret(page)).toMatchObject({ text: 'test\n', offset: BLANK_LINE });

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);
        expect(await caret(page)).toMatchObject({ text: 'test\n', offset: 0 });

        await placeCaret(page, 1, BLANK_LINE);
        await page.keyboard.press('ArrowDown');
        await nextFrames(page);
        expect((await caret(page)).text).toBe('');
    });

    test('the up-arrow still crosses blocks when the caret is on the first line', async ({ page }) => {
        await seedTrailingSoftBreak(page);
        await placeCaret(page, 1, 2);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        expect(await caret(page)).toMatchObject({ text: '', offset: 0 });
    });

    test('ArrowUp inside a two-line soft-break paragraph keeps moving line by line', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{ name: 'paragraph', text: 'aaa\nbbb' }]);
        });
        await placeCaret(page, 0, 'aaa\nbbb'.length);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        expect(await caret(page)).toMatchObject({ text: 'aaa\nbbb', offset: 3 });
    });

    test('with softNewlineAsSpace on, a soft break is not a line for the arrows', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setOptions({ softNewlineAsSpace: true }, true);
            window.muya!.setContent([
                { name: 'paragraph', text: 'alpha' },
                { name: 'paragraph', text: 'aaa\nbbb' },
            ]);
        });
        await expect(page.locator(editor.softLineBreak)).toHaveClass(/mu-soft-newline-as-space/);
        await placeCaret(page, 1, 4);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        expect(await caret(page)).toMatchObject({ text: 'alpha' });
    });
});
