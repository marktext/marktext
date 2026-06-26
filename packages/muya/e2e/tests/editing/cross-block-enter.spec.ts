import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #2443 — pressing Enter while a selection spans two blocks. The cross-block
// keydown handler only `preventDefault()`ed Backspace/Delete, so the browser's
// native Enter ran on top of the model edit and split/`<br>`-corrupted the
// contenteditable. Enter should behave like the same-block case: delete the
// selection and split at the caret into a new paragraph.

async function selectAcrossParagraphs(
    page: import('@playwright/test').Page,
    startOffset: number,
    endOffset: number,
): Promise<void> {
    await page.evaluate(({ startOffset, endOffset }) => {
        const paras = document.querySelectorAll('.mu-paragraph');
        const firstText = (el: Element): Text => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            return walker.nextNode() as Text;
        };
        const n1 = firstText(paras[0]);
        const n2 = firstText(paras[1]);
        const range = document.createRange();
        range.setStart(n1, startOffset);
        range.setEnd(n2, endOffset);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
    }, { startOffset, endOffset });
}

test.describe('cross-block selection + Enter (#2443)', () => {
    test('replaces the selection with a paragraph break, not native DOM corruption', async ({ page }) => {
        await loadMarkdown(page, 'Hello world\n\nFoo bar\n');
        await page.locator(editor.paragraph).first().click();

        // Select "world\n\nFoo": from after "Hello " (p1 offset 6) to after
        // "Foo" (p2 offset 3).
        await selectAcrossParagraphs(page, 6, 3);
        await page.keyboard.press('Enter');

        expect(await getMarkdown(page)).toBe('Hello \n\n bar\n');
    });
});
