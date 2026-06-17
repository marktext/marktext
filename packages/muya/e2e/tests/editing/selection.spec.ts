import { expect, test } from '../fixtures/muya';
import { metaKey } from '../helpers/keyboard';
import { editor, toolbar } from '../helpers/selectors';

test.describe('selection', () => {
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
            const sel = window.muya!.editor.selection.getSelection();
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
