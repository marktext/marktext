import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown, metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #4903 / #5148: replacing a selection that runs from a code fence's language
// line into that block's own code (paste, typing or Backspace; Shift+ArrowDown
// in the language input selects exactly this) dropped the paragraph after the
// code block from the json state while the editor still showed it. Editing that
// paragraph then threw inside the json flush ("Cannot insert into out of
// bounds index" on Enter, "Cannot pick up or remove undefined" on Backspace).

const DOC = 'Intro paragraph\n\n```js\nconst a = 1\n```\n\nOutro paragraph\n';

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

async function loadDocument(page: Page): Promise<void> {
    await loadMarkdown(page, DOC);
    // The code re-renders once the highlighter is ready, which resets a DOM
    // selection inside it, so only select after that render.
    await expect(page.locator(`${editor.codeContent} .token`).first()).toBeAttached();
    await nextFrames(page);
}

async function selectFromLanguageInputIntoCode(page: Page, languageOffset: number, codeOffset: number): Promise<void> {
    await page.evaluate(({ languageOffset, codeOffset }) => {
        const { scrollPage, selection } = window.muya!.editor;
        const languageInput = scrollPage!.firstContentInDescendant()!.nextContentInContext()!;
        const code = languageInput.nextContentInContext()!;
        selection.setSelection(
            { offset: languageOffset, block: languageInput, path: languageInput.path },
            { offset: codeOffset, block: code, path: code.path },
        );
    }, { languageOffset, codeOffset });
    await expect.poll(() => page.evaluate(() => {
        const selection = window.muya!.editor.selection.getSelection();
        return selection && `${selection.anchor.block.blockName}@${selection.anchor.offset} -> ${selection.focus.block.blockName}@${selection.focus.offset}`;
    })).toBe(`language-input@${languageOffset} -> codeblock.content@${codeOffset}`);
}

async function placeCaret(page: Page, text: string, offset: number): Promise<void> {
    await page.evaluate(({ text, offset }) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        block!.setCursor(offset, offset, true);
    }, { text, offset });
}

// The json state is what gets saved; the block tree is what the user edits.
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

test.describe('selection from a language line into its own code (#4903, #5148)', () => {
    test('pasting over it keeps the next paragraph editable', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        const errors = collectPageErrors(page);
        await loadDocument(page);

        await selectFromLanguageInputIntoCode(page, 1, 3);
        await page.evaluate(() => navigator.clipboard.writeText('python'));
        await page.keyboard.press(`${metaKey()}+v`);
        await expect.poll(() => getMarkdown(page)).toBe('Intro paragraph\n\njpythonst a = 1\n\nOutro paragraph\n');
        await expectTreeMatchesJson(page);

        await placeCaret(page, 'Outro paragraph', 'Outro paragraph'.length);
        await page.keyboard.press('Enter');
        await page.keyboard.type('next');
        await expect.poll(() => getMarkdown(page)).toBe('Intro paragraph\n\njpythonst a = 1\n\nOutro paragraph\n\nnext\n');
        await expectTreeMatchesJson(page);
        expect(errors).toEqual([]);
    });

    test('typing over it keeps the next paragraph editable', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadDocument(page);

        await selectFromLanguageInputIntoCode(page, 1, 3);
        await page.keyboard.type('q');
        await expect.poll(() => getMarkdown(page)).toBe('Intro paragraph\n\njqst a = 1\n\nOutro paragraph\n');
        await expectTreeMatchesJson(page);

        await placeCaret(page, 'Outro paragraph', 0);
        await page.keyboard.press('Backspace');
        await expect.poll(() => getMarkdown(page)).toBe('Intro paragraph\n\njqst a = 1Outro paragraph\n');
        await expectTreeMatchesJson(page);
        expect(errors).toEqual([]);
    });
});
