import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

// `update()` assigned `domNode.innerHTML` on every render, which destroys and
// recreates the child nodes even when the rebuilt string is byte-identical. A
// code block therefore replaced the text node the caret was in on every single
// keystroke, and an IME composes against that live node.
//
// Driven through CDP `Input.imeSetComposition`, so Chromium runs its own
// composition machinery and mutates the DOM itself — a hand-built event
// sequence would only stage the DOM the test author expects.

/**
 * Tag every child node the content element holds and keep counting, so a
 * rebuild (which mints fresh nodes) is visible as a new id rather than as an
 * equal-looking node.
 */
async function traceContentNodes(page: Page): Promise<void> {
    await page.evaluate((selector) => {
        const content = document.querySelector(selector) as HTMLElement;
        const firstChildIds: number[] = [];
        let rebuilds = 0;
        let nextId = 1;
        const idOf = (node: Node): number => {
            const tagged = node as Node & { __id?: number };
            tagged.__id ??= nextId++;
            return tagged.__id;
        };
        const noteFirstChild = () => {
            const first = content.firstChild;
            if (first == null)
                return;
            const id = idOf(first);
            if (firstChildIds.at(-1) !== id)
                firstChildIds.push(id);
        };
        noteFirstChild();
        new MutationObserver((records) => {
            for (const record of records) {
                if (record.type !== 'childList')
                    continue;
                rebuilds++;
                noteFirstChild();
            }
        }).observe(content, { childList: true, subtree: true });
        window.__nodeTrace = () => ({ firstChildIds, rebuilds });
    }, editor.codeContent);
}

/** Compose `romaji`, convert it to `kana`, then commit — one character. */
async function typeKana(cdp: CDPSession, romaji: string, kana: string): Promise<void> {
    await cdp.send('Input.imeSetComposition', {
        text: romaji,
        selectionStart: romaji.length,
        selectionEnd: romaji.length,
    });
    await cdp.send('Input.imeSetComposition', {
        text: kana,
        selectionStart: kana.length,
        selectionEnd: kana.length,
    });
    await cdp.send('Input.insertText', { text: kana });
}

async function openCodeBlock(page: Page, markdown: string): Promise<void> {
    await page.evaluate(md => window.muya!.setContent(md), markdown);
    await expect(page.locator(editor.codeBlock).first()).toBeVisible();
    await page.locator(editor.codeContent).first().click();
    await page.keyboard.press('Control+End');
    await traceContentNodes(page);
}

test.describe('code block DOM node identity across IME commits', () => {
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'Input.imeSetComposition is a Chrome DevTools Protocol command',
    );

    // An empty block, so the first character mints the one text node — every
    // composition after it has to keep composing into that same node.
    test('every composition starts from the node the previous one committed into', async ({ page }) => {
        await openCodeBlock(page, '```\n\n```\n');
        const cdp = await page.context().newCDPSession(page);

        await typeKana(cdp, 'te', 'て');
        await typeKana(cdp, 'su', 'す');
        await typeKana(cdp, 'to', 'と');

        await expect.poll(() => getMarkdown(page)).toBe('```\nてすと\n```\n');
        const trace = await page.evaluate(() => window.__nodeTrace!());
        expect(trace.firstChildIds).toHaveLength(1);
    });

    // The node has to survive the pauses too — a real input method pauses on
    // every candidate selection, and a debounce-based guard would rebuild
    // inside them. Seeded with text, so the node exists before the trace starts
    // and any childList mutation at all is a rebuild.
    test('the node survives a pause between characters', async ({ page }) => {
        await openCodeBlock(page, '```\nx\n```\n');
        const cdp = await page.context().newCDPSession(page);

        await typeKana(cdp, 'te', 'て');
        await page.waitForTimeout(500);
        await typeKana(cdp, 'su', 'す');
        await page.waitForTimeout(500);
        await typeKana(cdp, 'to', 'と');
        await page.waitForTimeout(500);

        await expect.poll(() => getMarkdown(page)).toBe('```\nxてすと\n```\n');
        const trace = await page.evaluate(() => window.__nodeTrace!());
        expect(trace.rebuilds).toBe(0);
    });

    test('a syntax-highlighted block keeps its node too', async ({ page }) => {
        await openCodeBlock(page, '```js\n// \n```\n');
        const cdp = await page.context().newCDPSession(page);

        await typeKana(cdp, 'te', 'て');
        await page.waitForTimeout(500);
        await typeKana(cdp, 'su', 'す');

        await expect.poll(() => getMarkdown(page)).toBe('```js\n// てす\n```\n');
        const trace = await page.evaluate(() => window.__nodeTrace!());
        expect(trace.rebuilds).toBe(0);
    });

    // Every keystroke used to tear the node down, not just an IME commit.
    test('plain typing does not rebuild the code DOM either', async ({ page }) => {
        await openCodeBlock(page, '```\nx\n```\n');

        await page.keyboard.type('abc');

        await expect.poll(() => getMarkdown(page)).toBe('```\nxabc\n```\n');
        const trace = await page.evaluate(() => window.__nodeTrace!());
        expect(trace.rebuilds).toBe(0);
    });
});
