import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, toolbar } from '../helpers/selectors';

test.describe('undo / redo', () => {
    test('button #undo reverts the latest typed text', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('start'));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await page.keyboard.press('End');
        await slowType(page, ' more');
        await expect(para).toContainText('start more');
        await page.locator(toolbar.undo).click();
        await expect(para).not.toContainText('start more');
        const md = await getMarkdown(page);
        expect(md).toContain('start');
        expect(md).not.toContain('start more');
    });

    test('#redo reapplies an undone edit', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('alpha'));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await page.keyboard.press('End');
        await slowType(page, 'beta');
        await expect(para).toContainText('alphabeta');
        await page.locator(toolbar.undo).click();
        await expect(para).not.toContainText('alphabeta');
        await page.locator(toolbar.redo).click();
        await expect(para).toContainText('alphabeta');
    });
});
