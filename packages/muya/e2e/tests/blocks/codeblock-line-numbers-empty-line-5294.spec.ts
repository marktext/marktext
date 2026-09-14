import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5294: with line numbers on, an empty code line's number was drawn above the
// block, below it, or on another line's row.

async function codeText(page: Page): Promise<string> {
    return page.locator(editor.codeContent).first().evaluate(el => el.textContent ?? '');
}

// How far below the first code line each number sits, in lines (to 0.1).
async function numberRows(page: Page): Promise<number[]> {
    return page.locator(editor.codeBlock).first().evaluate((pre, selectors) => {
        const code = pre.querySelector<HTMLElement>(selectors.codeContent)!;
        const lineHeight = Number.parseFloat(getComputedStyle(code).lineHeight);
        const codeTop = code.getBoundingClientRect().top;
        return Array.from(
            pre.querySelectorAll(selectors.lineNumber),
            span => Math.round((span.getBoundingClientRect().top - codeTop) / lineHeight * 10) / 10 + 0,
        );
    }, { codeContent: editor.codeContent, lineNumber: editor.lineNumber });
}

async function visualRows(page: Page): Promise<number> {
    return page.locator(editor.codeContent).first().evaluate(el =>
        Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)));
}

// A new code block re-renders on its first animation frame, which throws away
// a caret that typing has already moved.
async function settleCodeBlock(page: Page): Promise<void> {
    await expect(page.locator(editor.codeContent)).toHaveCount(1);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve))));
}

async function openCodeBlock(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent(''));
    await page.locator(editor.paragraph).first().click();
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await settleCodeBlock(page);
}

test.describe('code block line numbers on empty lines', () => {
    test('an empty line typed between two lines is numbered on its row', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await slowType(page, 'world');

        await expect.poll(() => codeText(page)).toBe('hello\n\nworld');
        await expect.poll(() => numberRows(page)).toEqual([0, 1, 2]);
    });

    test('empty lines typed at the end are numbered on their rows', async ({ page }) => {
        await openCodeBlock(page);
        await slowType(page, 'hello');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        await expect.poll(() => codeText(page)).toBe('hello\n\n');
        await expect.poll(() => numberRows(page)).toEqual([0, 1, 2]);
    });

    test('empty lines at the top of the block are numbered on their rows', async ({ page }) => {
        await openCodeBlock(page);
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await slowType(page, 'hello');

        await expect.poll(() => codeText(page)).toBe('\n\nhello');
        await expect.poll(() => numberRows(page)).toEqual([0, 1, 2]);
    });

    test('a syntax-highlighted block numbers its empty lines', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```js\nconst a = 1\n\n\nlet b = 2\n```\n'));
        await expect.poll(() => page.locator(`${editor.codeContent} .token`).count()).toBeGreaterThan(0);

        await expect.poll(() => numberRows(page)).toEqual([0, 1, 2, 3]);
    });
});

test.describe('wrapped code block line numbers on empty lines', () => {
    const longLine = 'word '.repeat(60).trim();

    test.beforeEach(async ({ page }) => {
        await page.evaluate(() => window.muya!.setOptions({ wrapCodeBlocks: true }));
    });

    // Rows are counted from the bottom of the block, so the expectations do
    // not depend on how many rows the long line wraps into.
    test('an empty line after a wrapped line is numbered on the row below it', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), `\`\`\`\n${longLine}\n\nend\n\`\`\`\n`);
        await settleCodeBlock(page);
        await expect.poll(() => visualRows(page)).toBeGreaterThan(3);

        await expect.poll(async () => {
            const rows = await visualRows(page);
            const [first, ...rest] = await numberRows(page);
            return [first, ...rest.map(row => rows - row)];
        }).toEqual([0, 2, 1]);
    });

    test('an empty line typed after a wrapped line is numbered on its row', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), `\`\`\`\n${longLine}\n\`\`\`\n`);
        await settleCodeBlock(page);
        const box = (await page.locator(editor.codeContent).first().boundingBox())!;
        await page.mouse.click(box.x + box.width - 2, box.y + box.height - 4);
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');

        await expect.poll(() => codeText(page)).toBe(`${longLine}\n`);
        await expect.poll(() => visualRows(page)).toBeGreaterThan(2);
        await expect.poll(async () => {
            const rows = await visualRows(page);
            const [first, ...rest] = await numberRows(page);
            return [first, ...rest.map(row => rows - row)];
        }).toEqual([0, 1]);
    });
});
