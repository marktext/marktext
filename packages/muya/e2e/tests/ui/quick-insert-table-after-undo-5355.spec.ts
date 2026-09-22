import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem, tablePickerCell, toolbar } from '../helpers/selectors';

// #5355: the table grid stays open while the document changes under it. After
// Undo removed the `/` line that opened it, a pick threw ("Cannot destructure
// property 'path' of 'this.parent' as it is null") or replaced the paragraph
// the caret had moved to. Such a pick now does nothing at all — it leaves the
// document, the caret and the focused element exactly as they were. The same
// Undo left the caret on the removed line, so the table dialog and Insert
// Paragraph threw on it.

const TABLE_2X2 = '|     |     |\n| --- | --- |\n|     |     |\n';

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function loadState(page: Page, texts: string[]): Promise<void> {
    await page.evaluate(texts => window.muya!.setContent(texts.map(text => ({ name: 'paragraph', text }))), texts);
}

async function placeCaretAtEnd(page: Page, text: string): Promise<void> {
    await page.evaluate((text) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        block!.setCursor(text.length, text.length, true);
    }, text);
}

// Undo and redo through the API, as the desktop Edit menu does: clicking the
// host's buttons would also close the grid through its document click handler.
async function undo(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.undo());
}

async function redo(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.redo());
}

async function isTablePickerShown(page: Page): Promise<boolean> {
    return page.evaluate(() => [...window.muya!.ui.shownFloat].some(float =>
        (float.constructor as { pluginName?: string }).pluginName === 'tablePicker'));
}

// The focused element and the caret muya believes in — everything an ignored
// pick has to leave untouched.
async function focusAndCaret(page: Page): Promise<string> {
    return page.evaluate(() => {
        const { editor } = window.muya!;
        const { anchorBlock, anchor } = editor.selection;
        const active = document.activeElement;
        return JSON.stringify({
            active: active ? `${active.tagName}.${String(active.className).split(' ')[0]}` : null,
            activeContent: editor.activeContentBlock?.text ?? null,
            attached: !!editor.activeContentBlock?.outMostBlock,
            anchorText: anchorBlock?.text ?? null,
            anchorOffset: anchor?.offset ?? null,
        });
    });
}

// Lets History close its one-second grouping window, so the next edit gets an
// undo entry of its own.
async function endUndoGroup(page: Page): Promise<void> {
    await page.waitForTimeout(1_200);
}

// Block edits reach the markdown on the next animation frame, so a check that
// the markdown did not change must wait for that frame first.
async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function expectMarkdownAfterFrames(page: Page, markdown: string): Promise<void> {
    await nextFrames(page);
    expect(await getMarkdown(page)).toBe(markdown);
}

async function openTableGridBelow(page: Page, text: string): Promise<void> {
    await placeCaretAtEnd(page, text);
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.locator(quickInsertItem('table')).click();
    await expect(page.locator(floats.tablePicker)).toBeVisible();
    await expect.poll(() => getMarkdown(page)).toContain('/');
}

async function pickGridCell(page: Page): Promise<void> {
    const cell = page.locator(tablePickerCell(1, 1));
    await cell.hover();
    await cell.click();
    await expect.poll(() => isTablePickerShown(page)).toBe(false);
}

test.describe('table grid after Undo removed the line that opened it (#5355)', () => {
    test('`/` Table in a paragraph: the pick changes nothing, and a click back into the text types as usual', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await openTableGridBelow(page, 'Hello');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorld\n');
        expect(await isTablePickerShown(page)).toBe(true);
        const before = await focusAndCaret(page);
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        // Nothing moved: the pick neither placed a caret nor pulled focus.
        expect(await focusAndCaret(page)).toBe(before);

        await page.locator(editor.paragraph).last().click();
        await page.keyboard.press('End');
        await page.keyboard.type('x');
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorldx\n');
        expect(errors).toEqual([]);
    });

    test('with the caret moved into the next paragraph before Undo, the pick leaves that paragraph alone', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'Hello');
        await page.keyboard.press('Enter');
        await slowType(page, '/table');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(page.locator(floats.tablePicker)).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorld\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        expect(errors).toEqual([]);
    });

    test('in a long document, the pick leaves the scroll position where it was', async ({ page }) => {
        const errors = collectPageErrors(page);
        const lines = Array.from({ length: 80 }, (_, index) => `Line ${index}`);
        await loadState(page, lines);
        await page.evaluate(() => {
            const line = [...document.querySelectorAll('.mu-paragraph')].find(node => node.textContent === 'Line 40');
            line!.scrollIntoView({ block: 'center' });
        });
        await openTableGridBelow(page, 'Line 40');
        const lineTop = () => page.evaluate(() => {
            const line = [...document.querySelectorAll('.mu-paragraph')].find(node => node.textContent?.startsWith('Line 40'));
            return { top: line!.getBoundingClientRect().top, viewport: window.innerHeight, scrollTop: document.scrollingElement!.scrollTop };
        });
        const before = await lineTop();
        expect(before.scrollTop).toBeGreaterThan(0);

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe(`${lines.join('\n\n')}\n`);
        await pickGridCell(page);
        await nextFrames(page);

        const after = await lineTop();
        expect(after.scrollTop).toBe(before.scrollTop);
        expect(after.top).toBe(before.top);
        expect(await getMarkdown(page)).toBe(`${lines.join('\n\n')}\n`);
        expect(errors).toEqual([]);
    });

    test('`/table` and Enter: the pick changes nothing', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'Hello');
        await page.keyboard.press('Enter');
        await slowType(page, '/table');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(page.locator(floats.tablePicker)).toBeVisible();

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorld\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        expect(errors).toEqual([]);
    });

    test('inside a list item: the pick changes nothing', async ({ page }) => {
        const errors = collectPageErrors(page);
        await page.evaluate(() => window.muya!.setContent('- item one\n- item two\n'));
        await openTableGridBelow(page, 'item one');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('- item one\n- item two\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, '- item one\n- item two\n');
        expect(errors).toEqual([]);
    });

    test('after earlier edits: the paragraph the caret returned to keeps its text', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'World');
        await slowType(page, ' zz');
        await endUndoGroup(page);
        await openTableGridBelow(page, 'Hello');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorld zz\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld zz\n');
        expect(errors).toEqual([]);
    });
});

// Redo re-creates the removed line as a different block, so the grid no longer
// has a line to act on. A pick then inserts nothing, where it used to insert
// the table.
test.describe('table grid after Undo then Redo re-created the line that opened it (#5355)', () => {
    for (const earlierEdit of [false, true]) {
        test(`the pick changes nothing${earlierEdit ? ' after earlier edits' : ''}`, async ({ page }) => {
            const errors = collectPageErrors(page);
            await loadState(page, ['Hello', 'World']);
            let world = 'World';
            if (earlierEdit) {
                await placeCaretAtEnd(page, 'World');
                await slowType(page, ' zz');
                await endUndoGroup(page);
                world = 'World zz';
            }
            await openTableGridBelow(page, 'Hello');

            await undo(page);
            await expect.poll(() => getMarkdown(page)).toBe(`Hello\n\n${world}\n`);
            await redo(page);
            await expect.poll(() => getMarkdown(page)).toBe(`Hello\n\n/\n\n${world}\n`);
            await pickGridCell(page);

            await expectMarkdownAfterFrames(page, `Hello\n\n/\n\n${world}\n`);
            expect(errors).toEqual([]);
        });
    }
});

test.describe('table grid with a line of the same text below the line that opened it (#5355)', () => {
    test('Undo: the pick keeps the line that moved into its place', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', '/', 'World']);
        await openTableGridBelow(page, 'Hello');
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\n/\n\n/\n\nWorld\n');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\n/\n\nWorld\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\n/\n\nWorld\n');
        expect(errors).toEqual([]);
    });
});

test.describe('table grid whose line no longer holds only its query (#5355)', () => {
    test('Undo restored real text into the line: the pick keeps that text', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'abc', 'World']);
        await page.evaluate(() => window.muya!.editor.scrollPage!.find(1)!.firstContentInDescendant()!.setCursor(0, 3, true));
        await slowType(page, '/table');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(page.locator(floats.tablePicker)).toBeVisible();
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\n/table\n\nWorld\n');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nabc\n\nWorld\n');
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nabc\n\nWorld\n');
        expect(errors).toEqual([]);
    });

    test('the query was replaced by typed text while the grid stayed open: the pick keeps that text', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'Hello');
        await page.keyboard.press('Enter');
        await slowType(page, '/table');
        await page.keyboard.press('Enter');
        await expect(page.locator(floats.tablePicker)).toBeVisible();

        for (let i = 0; i < '/table'.length; i++)
            await page.keyboard.press('Backspace');
        await slowType(page, 'Important');
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nImportant\n\nWorld\n');
        expect(await isTablePickerShown(page)).toBe(true);
        await pickGridCell(page);

        await expectMarkdownAfterFrames(page, 'Hello\n\nImportant\n\nWorld\n');
        expect(errors).toEqual([]);
    });

    test('Undo removed only the `/`: the empty line becomes the table, not the paragraph holding the caret', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', '', 'World']);
        await placeCaretAtEnd(page, 'World');
        await slowType(page, ' zz');
        await endUndoGroup(page);
        await placeCaretAtEnd(page, '');
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('table')).click();
        await expect(page.locator(floats.tablePicker)).toBeVisible();

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\n\n\nWorld zz\n');
        await pickGridCell(page);

        await expect.poll(() => getMarkdown(page)).toBe(`Hello\n\n${TABLE_2X2}\nWorld zz\n`);
        expect(errors).toEqual([]);
    });
});

test.describe('Undo while focus is outside the document (#5355)', () => {
    test('focus stays in the search box and typing does not reach the document', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'Hello');
        await page.keyboard.press('Enter');
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\n\n\nWorld\n');
        await page.locator(toolbar.search).click();
        await page.keyboard.type('Wo');

        await undo(page);
        await page.keyboard.type('r');

        await expect(page.locator(toolbar.search)).toBeFocused();
        await expect(page.locator(toolbar.search)).toHaveValue('Wor');
        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        expect(errors).toEqual([]);
    });

    test('focus stays in the grid\'s row input, and its Enter changes nothing', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await openTableGridBelow(page, 'Hello');
        const rowInput = page.locator(`${floats.tablePicker} input.row-input`);
        await rowInput.click();
        await page.keyboard.type('3');

        await undo(page);
        await page.keyboard.press('Backspace');
        await page.keyboard.type('4');
        await expect(rowInput).toBeFocused();
        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');

        await page.keyboard.press('Enter');
        await expect.poll(() => isTablePickerShown(page)).toBe(false);
        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        expect(errors).toEqual([]);
    });
});

test.describe('block commands after Undo removed the caret line (#5355)', () => {
    test('the table dialog\'s createTable and Insert Paragraph Before / After do nothing instead of throwing', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['Hello', 'World']);
        await placeCaretAtEnd(page, 'Hello');
        await page.keyboard.press('Enter');
        await slowType(page, 'abc');
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nabc\n\nWorld\n');

        await undo(page);
        await expect.poll(() => getMarkdown(page)).toBe('Hello\n\nWorld\n');
        const thrown = await page.evaluate(() => {
            const messages: string[] = [];
            for (const run of [
                () => window.muya!.createTable({ rows: 4, columns: 3 }),
                () => window.muya!.insertParagraph('before'),
                () => window.muya!.insertParagraph('after'),
            ]) {
                try {
                    run();
                }
                catch (error) {
                    messages.push(String(error));
                }
            }
            return messages;
        });

        expect(thrown).toEqual([]);
        await expectMarkdownAfterFrames(page, 'Hello\n\nWorld\n');
        expect(errors).toEqual([]);
    });
});

test.describe('front menu Table (#5355)', () => {
    test('the hovered empty paragraph becomes the table, not the paragraph holding the caret', async ({ page }) => {
        const errors = collectPageErrors(page);
        await loadState(page, ['', 'World']);
        await placeCaretAtEnd(page, 'World');

        const emptyParagraph = page.locator(editor.paragraph).first();
        const box = (await emptyParagraph.boundingBox())!;
        // The front button tracks the pointer through a throttled mousemove,
        // so move twice to be sure it saw the hovered paragraph.
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.waitForTimeout(350);
        await page.mouse.move(box.x + 12, box.y + box.height / 2);
        await page.locator(floats.paragraphFrontButtonInner).click();
        await page.locator(`${floats.paragraphFrontMenu} .turn-into-item.table`).click();
        await expect(page.locator(floats.tablePicker)).toBeVisible();
        await pickGridCell(page);

        await expect.poll(() => getMarkdown(page)).toBe(`${TABLE_2X2}\nWorld\n`);
        expect(errors).toEqual([]);
    });
});
