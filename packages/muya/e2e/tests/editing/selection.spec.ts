import { expect, test } from '../fixtures/muya';
import { metaKey } from '../helpers/keyboard';
import { editor, toolbar } from '../helpers/selectors';

test.describe('selection', () => {
    test('keeps keyboard-selected block endpoints across a transient native collapse', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('alpha\n\nbeta\n'));
        await page.locator(editor.paragraph).first().click();
        await page.evaluate(() => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        });
        await page.keyboard.down('Shift');
        for (let i = 0; i < 8; i++)
            await page.keyboard.press('ArrowRight');
        await page.keyboard.up('Shift');
        const selected = await page.evaluate(() => window.muya!.getSelectionState());
        expect(selected?.kind).toBe('text');
        if (selected?.kind === 'text')
            expect(selected.anchor.path).not.toEqual(selected.focus.path);

        await page.evaluate(() => {
            const muya = window.muya!;
            const block = muya.editor.scrollPage!.firstContentInDescendant()!;
            const text = document.createTreeWalker(block.domNode!, NodeFilter.SHOW_TEXT).nextNode();
            window.getSelection()!.collapse(text, 0);
            muya.updateParagraph('blockquote');
        });
        await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown()))
            .toBe('> alpha\n>\n> beta\n');
    });

    test('#select-all button (clicked twice) selects across blocks', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('first paragraph\n\nsecond paragraph\n');
        });
        await page.locator(editor.paragraph).first().click();
        // selectAll's semantics: first call selects within the active block,
        // a subsequent call (when current block is already fully selected)
        // spans the whole document.
        await page.locator(toolbar.selectAll).click();
        await page.locator(toolbar.selectAll).click();
        const hasMultiBlockSelection = await page.evaluate(() => {
            const sel = window.muya!.editor.selection.getTextSelection();
            if (!sel)
                return false;
            const { anchor, focus } = sel;
            return anchor.block !== focus.block;
        });
        expect(hasMultiBlockSelection).toBe(true);
    });

    test('Cmd/Ctrl+A selects the whole document', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('alpha\n\nbeta\n\ngamma\n');
        });
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.press(`${metaKey()}+a`);
        // After select-all the browser selection should span across blocks.
        const selText = await page.evaluate(() => window.getSelection()?.toString());
        expect(selText).toContain('alpha');
        expect(selText).toContain('gamma');
    });
});
