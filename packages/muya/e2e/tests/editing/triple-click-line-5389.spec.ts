import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function tripleClickLine(page: Page, text: string): Promise<void> {
    await page.locator(editor.content).filter({ hasText: text }).first().click({ clickCount: 3 });
}

async function tripleClickDrag(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
): Promise<void> {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up();
    await page.mouse.down({ clickCount: 3 });
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
}

async function edgeOf(page: Page, needle: string, edge: 'start' | 'end'): Promise<{ x: number; y: number }> {
    return page.evaluate(({ text, side }) => {
        const root = document.querySelector('.mu-editor')!;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null = walker.nextNode();
        while (node) {
            const index = (node.textContent ?? '').indexOf(text);
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                const rect = range.getBoundingClientRect();
                return {
                    x: side === 'start' ? rect.x + 2 : rect.x + rect.width - 2,
                    y: rect.y + rect.height / 2,
                };
            }
            node = walker.nextNode();
        }
        throw new Error(`not found: ${text}`);
    }, { text: needle, side: edge });
}

const NEXT_BLOCK_KEPT: Array<{ name: string; markdown: string; expected: string }> = [
    { name: 'a thematic break', markdown: 'alpha beta\n\n***\n', expected: 'x\n\n***\n' },
    { name: 'a bullet list', markdown: 'alpha beta\n\n- item one\n- item two\n', expected: 'x\n\n- item one\n- item two\n' },
    { name: 'an ordered list', markdown: 'alpha beta\n\n1. item one\n2. item two\n', expected: 'x\n\n1. item one\n2. item two\n' },
    { name: 'a block quote', markdown: 'alpha beta\n\n> quoted words\n', expected: 'x\n\n> quoted words\n' },
    { name: 'a paragraph', markdown: 'alpha beta\n\nnext words\n', expected: 'x\n\nnext words\n' },
    { name: 'a table', markdown: 'alpha beta\n\n| h1 | h2 |\n| -- | -- |\n| c1 | c2 |\n', expected: 'x\n\n| h1  | h2  |\n| --- | --- |\n| c1  | c2  |\n' },
    { name: 'a task list', markdown: 'alpha beta\n\n- [ ] task one\n', expected: 'x\n\n- [ ] task one\n' },
    { name: 'an atx heading', markdown: 'alpha beta\n\n# next heading\n', expected: 'x\n\n# next heading\n' },
    { name: 'a setext heading', markdown: 'alpha beta\n\nNext heading\n===\n', expected: 'x\n\nNext heading\n===\n' },
    { name: 'a math block', markdown: 'alpha beta\n\n$$\na+b\n$$\n', expected: 'x\n\n$$\na+b\n$$\n' },
    { name: 'an html block', markdown: 'alpha beta\n\n<div>hi</div>\n', expected: 'x\n\n<div>hi</div>\n' },
    { name: 'a fenced code block', markdown: 'alpha beta\n\n```js\nconst a = 1\n```\n', expected: 'x\n\n```js\nconst a = 1\n```\n' },
];

test.describe('typing over a triple-clicked line (#5389)', () => {
    for (const { name, markdown, expected } of NEXT_BLOCK_KEPT) {
        test(`replaces the line and leaves ${name} below it alone`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', err => errors.push(String(err?.message ?? err)));
            await loadMarkdown(page, markdown);
            await nextFrames(page);

            await tripleClickLine(page, 'alpha beta');
            await page.keyboard.type('x');

            await expect.poll(() => getMarkdown(page)).toBe(expected);
            expect(errors).toEqual([]);
        });
    }

    test('replaces a front-matter line without pulling the body into it', async ({ page }) => {
        await loadMarkdown(page, '---\ntitle: alpha\n---\n\nnext words\n');
        await nextFrames(page);

        await tripleClickLine(page, 'title: alpha');
        await page.keyboard.type('x');

        await expect.poll(() => getMarkdown(page)).toBe('---\nx\n---\n\nnext words\n');
    });

    test('replaces one line of a multi-line code block, joining nothing', async ({ page }) => {
        await loadMarkdown(page, '```js\nline one\nline two\nline three\n```\n');
        await nextFrames(page);

        await tripleClickLine(page, 'line two');
        await page.keyboard.type('x');

        await expect.poll(() => getMarkdown(page)).toBe('```js\nline one\nx\nline three\n```\n');
    });

    test('replaces a list item without absorbing the next one', async ({ page }) => {
        await loadMarkdown(page, '- item one\n- item two\n\nnext words\n');
        await nextFrames(page);

        await tripleClickLine(page, 'item one');
        await page.keyboard.type('x');

        await expect.poll(() => getMarkdown(page)).toBe('- x\n- item two\n\nnext words\n');
    });

    test('replaces a quoted line without pulling the paragraph into the quote', async ({ page }) => {
        await loadMarkdown(page, '> quoted words\n\nnext words\n');
        await nextFrames(page);

        await tripleClickLine(page, 'quoted words');
        await page.keyboard.type('x');

        await expect.poll(() => getMarkdown(page)).toBe('> x\n\nnext words\n');
    });

    test('Backspace clears the line and keeps the block below', async ({ page }) => {
        await loadMarkdown(page, 'alpha beta\n\n***\n');
        await nextFrames(page);

        await tripleClickLine(page, 'alpha beta');
        await page.keyboard.press('Backspace');

        await expect.poll(() => getMarkdown(page)).toBe('\n\n***\n');
    });

    test('leaves no detached block behind, so a later Enter on the list above does not throw', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(String(err?.message ?? err)));
        await loadMarkdown(page, '- one\n- two\n\ntext\n\n- [ ] task\n');
        await nextFrames(page);

        await tripleClickLine(page, 'text');
        await page.keyboard.type('x');
        await expect.poll(() => getMarkdown(page)).toBe('- one\n- two\n\nx\n\n- [ ] task\n');

        await page.locator(editor.content).filter({ hasText: 'two' }).first().click();
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        await expect.poll(() => getMarkdown(page)).toBe('- one\n- two\n\n\n\nx\n\n- [ ] task\n');
        expect(errors).toEqual([]);
    });

    test.describe('dragging on from the triple-click', () => {
        const DRAGS: Array<{ name: string; markdown: string; from: string; to: string; expected: string }> = [
            { name: 'downwards across blocks', markdown: 'one one\n\ntwo two\n\nthree three\n\nfour four\n', from: 'one one', to: 'three three', expected: 'x\n\ntwo two\n\nthree three\n\nfour four\n' },
            { name: 'upwards across blocks', markdown: 'one one\n\ntwo two\n\nthree three\n\nfour four\n', from: 'three three', to: 'one one', expected: 'one one\n\ntwo two\n\nx\n\nfour four\n' },
            { name: 'within one code block', markdown: '```js\nline one\nline two\nline three\nline four\n```\n', from: 'line two', to: 'line four', expected: '```js\nline one\nx\nline three\nline four\n```\n' },
        ];

        for (const { name, markdown, from, to, expected } of DRAGS) {
            test(`${name} still replaces only the clicked line`, async ({ page }) => {
                await loadMarkdown(page, markdown);
                await nextFrames(page);

                await tripleClickDrag(page, await edgeOf(page, from, 'start'), await edgeOf(page, to, 'end'));
                await page.keyboard.type('x');

                await expect.poll(() => getMarkdown(page)).toBe(expected);
            });
        }
    });
});
