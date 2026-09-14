import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5114: Enter at the end of a code block whose text already ended in a newline
// left the caret on the same visual line — the last line had no line box.

interface ICodeGeometry {
    left: number;
    top: number;
    lineHeight: number;
    lines: number;
}

async function codeGeometry(page: Page): Promise<ICodeGeometry> {
    return page.locator(editor.codeContent).first().evaluate((el) => {
        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
        const { left, top, height } = el.getBoundingClientRect();
        return { left, top, lineHeight, lines: Math.round(height / lineHeight) };
    });
}

async function codeText(page: Page): Promise<string> {
    return page.locator(editor.codeContent).first().evaluate(el => el.textContent ?? '');
}

// A collapsed range right after a newline has no client rects, so the painted
// caret is located in a screenshot instead: glyphs hidden, caret pure red.
async function caretLine(page: Page): Promise<number | null> {
    const clip = (await page.locator(editor.codeContent).first().boundingBox())!;
    const { top, lineHeight } = await codeGeometry(page);

    for (let attempt = 0; attempt < 10; attempt++) {
        const png = await page.screenshot({ clip, caret: 'initial' });
        const caretY = await page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
            const rows: number[] = [];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) {
                        rows.push(y);
                        break;
                    }
                }
            }
            return rows.length ? (rows[0] + rows[rows.length - 1]) / 2 : null;
        }, png.toString('base64'));

        if (caretY != null)
            return Math.floor((clip.y + caretY - top) / lineHeight) + 1;
        await page.waitForTimeout(100);
    }

    return null;
}

// A new code block re-renders on its first animation frame (the line-number
// gutter seed in codeBlock/index.ts, and the language load), which throws away
// a caret that typing has already moved.
async function settleNewCodeBlock(page: Page): Promise<void> {
    await expect(page.locator(editor.codeContent)).toHaveCount(1);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve))));
}

async function openCodeBlock(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent(''));
    await page.locator(editor.paragraph).first().click();
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await settleNewCodeBlock(page);
}

test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
        content: `${editor.codeContent}, ${editor.codeContent} * {
            color: transparent !important;
            caret-color: rgb(255, 0, 0) !important;
            caret-animation: manual;
        }`,
    });
});

test.describe('code block Enter at a trailing newline', () => {
    test('Enter twice after a line puts the caret on a third line', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        await expect.poll(() => codeText(page)).toBe('hello\n\n');
        expect((await codeGeometry(page)).lines).toBe(3);
        expect(await caretLine(page)).toBe(3);

        await slowType(page, 'x');
        await expect.poll(() => codeText(page)).toBe('hello\n\nx');
    });

    test('Enter in an empty code block puts the caret on a second line', async ({ page }) => {
        await openCodeBlock(page);
        await page.keyboard.press('Enter');

        await expect.poll(() => codeText(page)).toBe('\n');
        expect((await codeGeometry(page)).lines).toBe(2);
        expect(await caretLine(page)).toBe(2);
    });

    test('a syntax-highlighted block keeps its empty last line', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```js\nconst a = 1\n```\n'));
        await settleNewCodeBlock(page);
        await page.locator(editor.codeContent).first().click();
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        await expect.poll(() => codeText(page)).toBe('const a = 1\n\n');
        expect(await page.locator(`${editor.codeContent} .token`).count()).toBeGreaterThan(0);
        expect((await codeGeometry(page)).lines).toBe(3);
        expect(await caretLine(page)).toBe(3);
    });
});

test.describe('code block caret on the empty last line', () => {
    test('clicking the empty last line types at the end of the code', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        const { left, top, lineHeight } = await codeGeometry(page);
        await page.mouse.click(left + 40, top + lineHeight * 0.5);
        await page.mouse.click(left + 40, top + lineHeight * 2.5);
        await slowType(page, 'z');

        await expect.poll(() => codeText(page)).toBe('hello\n\nz');
    });

    test('ArrowDown onto the empty last line types at the end of the code', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await slowType(page, 'abc');
        await page.keyboard.press('Enter');

        const { left, top, lineHeight } = await codeGeometry(page);
        await page.mouse.click(left + 200, top + lineHeight * 1.5);
        await page.keyboard.press('ArrowDown');
        await slowType(page, 'q');

        await expect.poll(() => codeText(page)).toBe('hello\nabc\nq');
    });
});

test.describe('code block arrow keys on empty lines', () => {
    test('ArrowUp from the empty last line moves to the line above', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await slowType(page, 'world');
        await page.keyboard.press('Enter');

        await page.keyboard.press('ArrowUp');
        await slowType(page, 'X');

        await expect.poll(() => codeText(page)).toMatch(/^hello\n[^\n]*X[^\n]*\n$/);
    });

    test('ArrowDown from an empty line moves to the line below', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await slowType(page, 'world');

        const { left, top, lineHeight } = await codeGeometry(page);
        await page.mouse.click(left + 40, top + lineHeight * 1.5);
        await page.keyboard.press('ArrowDown');
        await slowType(page, 'Y');

        await expect.poll(() => codeText(page)).toMatch(/^hello\n\n[^\n]*Y[^\n]*$/);
    });

    test('ArrowUp on the first line still leaves the code block', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await slowType(page, 'world');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');

        await expect.poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.blockName)).not.toBe('codeblock.content');
        expect(await codeText(page)).toBe('hello\nworld');
    });
});

test.describe('code block IME composition on the empty last line', () => {
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'Input.imeSetComposition is a Chrome DevTools Protocol command',
    );

    test('composes on the empty last line and commits at the end', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });

        const composedLine = await page.locator(editor.codeContent).first().evaluate((el) => {
            const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const index = node.textContent!.indexOf('ni');
                if (index === -1)
                    continue;
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + 2);
                const { top, bottom } = range.getBoundingClientRect();
                return Math.floor(((top + bottom) / 2 - el.getBoundingClientRect().top) / lineHeight) + 1;
            }
            return null;
        });
        expect(composedLine).toBe(3);

        await cdp.send('Input.imeSetComposition', { text: '你', selectionStart: 1, selectionEnd: 1 });
        await cdp.send('Input.insertText', { text: '你' });

        await expect.poll(() => codeText(page)).toBe('hello\n\n你');
    });
});
