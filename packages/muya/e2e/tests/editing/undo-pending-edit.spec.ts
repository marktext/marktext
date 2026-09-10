import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

async function treeMatchesState(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const muya = window.muya!;
        const blocks: unknown[] = [];
        let node = muya.editor.scrollPage.children.head;
        while (node) {
            blocks.push(node.getState());
            node = node.next;
        }
        return JSON.stringify(muya.getState()) === JSON.stringify(blocks);
    });
}

async function typeAtEnd(page: Page, markdown: string, text: string): Promise<void> {
    await page.evaluate(md => window.muya!.setContent(md), markdown);
    await page.evaluate(() => {
        const content = window.muya!.editor.scrollPage.lastContentInDescendant();
        content.setCursor(content.text.length, content.text.length, true);
    });
    await page.waitForTimeout(100);
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(300);
}

// Keystrokes and Cmd/Ctrl+Z can land in the same animation frame, before the
// queued text edit is flushed; drive that ordering directly.
const sameFrameSequences = [
    {
        name: 'a text edit',
        markdown: 'a\n\nb\n',
        run: `const c = window.muya.editor.activeContentBlock; c.text = c.text + 'x'; window.muya.undo();`,
    },
    {
        name: 'a text edit followed by Enter',
        markdown: '- one\n- two\n',
        run: `const c = window.muya.editor.activeContentBlock; c.text = c.text + 'x'; c.setCursor(c.text.length, c.text.length, true); c.enterHandler(new KeyboardEvent('keydown', { key: 'Enter' })); window.muya.undo();`,
    },
];

for (const sequence of sameFrameSequences) {
    test(`undo in the same frame as ${sequence.name} keeps the document consistent`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(String(err?.message || err)));

        await typeAtEnd(page, sequence.markdown, ' more');
        await page.evaluate((code) => {
            // eslint-disable-next-line no-new-func
            new Function(code)();
        }, sequence.run);
        await page.waitForTimeout(300);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        expect(await treeMatchesState(page)).toBe(true);

        await page.keyboard.type('q', { delay: 20 });
        await page.waitForTimeout(300);
        expect(await treeMatchesState(page)).toBe(true);
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });
}
