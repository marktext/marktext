import process from 'node:process';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { focusEditor, loadMarkdown } from '../helpers/keyboard';

// #3452 — document-level navigation: macOS ⌘↑/⌘↓, Windows/Linux Ctrl+Home/End.
// The engine's part is to refuse the key; the browser moves the caret and the
// engine adopts it on keyup, so asserting the caret covers both halves.
//
// Blink binds these keys per platform (`editing_behavior.cc`: Ctrl+Home/End only
// when !IS_MAC), so each group runs where its binding exists — the Ctrl group
// covers the Windows/Linux path on the Linux CI runner.

const isMac = process.platform === 'darwin';

// Playwright's default agent reports Windows on every host, which would leave
// muya's `isOsx` branch inactive — report macOS instead.
const MAC_UA
    = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

const THREE_PARAGRAPHS = 'para one\n\npara two\n\npara three\n';
const TABLE = 'para one\n\n| head a | head b |\n| --- | --- |\n| cell a | cell b |\n\npara two\n';

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function placeCaret(page: Page, text: string, offset: number): Promise<void> {
    await page.evaluate(({ text, offset }) => {
        const leaves: Array<{ text: string; setCursor: (a: number, b: number, c?: boolean) => void }> = [];
        window.muya!.editor.scrollPage!.depthFirstTraverse((block) => {
            if (block.isContent())
                leaves.push(block as never);
        });
        const leaf = leaves.find(item => item.text === text);
        if (!leaf)
            throw new Error(`no content leaf with text "${text}"`);
        leaf.setCursor(offset, offset, true);
    }, { text, offset });
    await nextFrames(page);
}

/** The engine's caret plus the document's first/last content leaf. */
async function state(page: Page) {
    return page.evaluate(() => {
        const { selection, scrollPage } = window.muya!.editor;
        const first = scrollPage!.firstContentInDescendant()!;
        const last = scrollPage!.lastContentInDescendant()!;
        return {
            anchorText: selection.anchorBlock?.text ?? null,
            anchorOffset: selection.anchor?.offset ?? null,
            focusText: selection.focusBlock?.text ?? null,
            focusOffset: selection.focus?.offset ?? null,
            firstText: first.text,
            lastText: last.text,
            lastLength: last.text.length,
        };
    });
}

test.describe('macOS ⌘↑/⌘↓ reach the document edges (#3452)', () => {
    test.skip(!isMac, 'requires a macOS browser build');
    test.use({ userAgent: MAC_UA });

    test('⌘↑ moves the caret to the start of the document', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para two', 4);

        await page.keyboard.press('Meta+ArrowUp');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.firstText);
        expect(after.anchorOffset).toBe(0);
    });

    test('⌘↓ moves the caret to the end of the document', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para two', 4);

        await page.keyboard.press('Meta+ArrowDown');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.lastText);
        expect(after.anchorOffset).toBe(after.lastLength);
    });

    test('⌘↑ works from inside a table cell', async ({ page }) => {
        await loadMarkdown(page, TABLE);
        await focusEditor(page);
        await placeCaret(page, 'cell a', 2);

        await page.keyboard.press('Meta+ArrowUp');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.firstText);
        expect(after.anchorOffset).toBe(0);
    });

    test('⌘⇧↑ still extends the browser selection to the document start', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para two', 4);

        await page.keyboard.press('Meta+Shift+ArrowUp');
        await nextFrames(page);

        // The native range, not the engine: a ⇧ selection spanning blocks is not
        // adopted on keyup, the pre-existing behaviour for cross-block ranges.
        const range = await page.evaluate(() => {
            const live = document.getSelection()!.getRangeAt(0);
            return {
                collapsed: live.collapsed,
                startText: live.startContainer.textContent,
                startOffset: live.startOffset,
            };
        });
        const edges = await state(page);
        expect(range.collapsed).toBe(false);
        expect(range.startText).toBe(edges.firstText);
        expect(range.startOffset).toBe(0);
    });

    test('plain arrows still move by block, not to the document edge', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para two', 4);

        await page.keyboard.press('ArrowUp');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe('para one');
        // The cross-block move keeps the column, unlike the ⌘↑ jump above.
        expect(after.anchorOffset).not.toBe(0);
    });
});

test.describe('Windows/Linux Ctrl+Home/Ctrl+End reach the document edges (#3452)', () => {
    test.skip(isMac, 'Ctrl+Home/End is not bound on macOS');

    test('Ctrl+Home moves the caret to the start of the document', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para three', 3);

        await page.keyboard.press('Control+Home');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.firstText);
        expect(after.anchorOffset).toBe(0);
    });

    test('Ctrl+End moves the caret to the end of the document', async ({ page }) => {
        await loadMarkdown(page, THREE_PARAGRAPHS);
        await focusEditor(page);
        await placeCaret(page, 'para one', 3);

        await page.keyboard.press('Control+End');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.lastText);
        expect(after.anchorOffset).toBe(after.lastLength);
    });

    test('Ctrl+Home works from inside a table cell', async ({ page }) => {
        await loadMarkdown(page, TABLE);
        await focusEditor(page);
        await placeCaret(page, 'cell b', 2);

        await page.keyboard.press('Control+Home');
        await nextFrames(page);

        const after = await state(page);
        expect(after.anchorText).toBe(after.firstText);
        expect(after.anchorOffset).toBe(0);
    });
});
