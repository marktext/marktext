import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { loadMarkdown, metaKey } from '../helpers/keyboard';
import { nextFrames } from '../helpers/tree';

// #5239 follow-up: deferring the chord to the browser exposed a caret bug in
// multi-line blocks — a browser anchors the caret to an element after a line
// delete, and the engine read that child index as a character offset.

interface ContentLike {
    text: string;
    domNode: HTMLElement;
    setCursor: (a: number, b: number, c: boolean) => void;
    getCursor: () => { start: { offset: number } } | null;
}

const CASES = [
    { name: 'code block', md: '```\nfoo\nbar zar\n```\n', blockName: 'codeblock.content' },
    { name: 'soft-break paragraph', md: 'foo\nbar zar\n', blockName: 'paragraph.content' },
];

async function caretAt(page: Page, blockName: string, offset?: number): Promise<void> {
    await page.evaluate(({ name, at }) => {
        const find = (block: {
            constructor: { blockName?: string };
            children?: { forEach: (cb: (b: unknown) => void) => void };
        }): unknown => {
            let hit: unknown = null;
            const visit = (b: typeof block) => {
                if (b.constructor.blockName === name)
                    hit ??= b;
                b.children?.forEach(c => visit(c as typeof block));
            };
            visit(block);
            return hit;
        };
        const content = find(
            window.muya!.editor.scrollPage as unknown as Parameters<typeof find>[0],
        ) as ContentLike;
        (window as unknown as { __content: unknown }).__content = content;
        const target = at ?? content.text.length;
        content.setCursor(target, target, true);
        content.domNode.focus();
    }, { name: blockName, at: offset });
}

async function caretOffset(page: Page): Promise<{ text: string; offset: number | null }> {
    return page.evaluate(() => {
        const content = (window as unknown as { __content: ContentLike }).__content;
        return { text: content.text, offset: content.getCursor()?.start?.offset ?? null };
    });
}

for (const c of CASES) {
    test(`${metaKey()}+Backspace keeps the caret at the end of the remaining text — ${c.name} (#5239)`, async ({ page }) => {
        await loadMarkdown(page, c.md);
        await nextFrames(page);
        await caretAt(page, c.blockName);
        await nextFrames(page);

        await page.keyboard.press(`${metaKey()}+Backspace`);
        await nextFrames(page);

        const { text, offset } = await caretOffset(page);
        expect(offset).toBe(text.length);
        expect(text.startsWith('foo\n')).toBe(true);
    });
}

// A highlighted code block owns a token-boundary fix-up that used to trim a
// single character off the token before the browser saw the chord.
test(`${metaKey()}+Backspace deletes the whole word at a Prism token boundary (#5239)`, async ({ page }) => {
    await loadMarkdown(page, '```js\nconst x = 1\n```\n');
    await nextFrames(page);
    // Prism resolves the grammar asynchronously; until it loads the token branch
    // is skipped and this passes even with the fix reverted.
    await expect.poll(() => page.locator('.mu-codeblock-content span.token').count()).toBeGreaterThan(0);

    await caretAt(page, 'codeblock.content', 'const'.length);
    await nextFrames(page);
    const before = (await caretOffset(page)).text.length;

    await page.keyboard.press(`${metaKey()}+Backspace`);
    await nextFrames(page);

    const { text, offset } = await caretOffset(page);
    expect.soft(before - text.length).toBeGreaterThanOrEqual('const'.length);
    expect(offset).toBe(0);
});
