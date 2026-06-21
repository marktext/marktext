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

    // #3825: undo coalesced every keystroke typed within History's 1s window
    // into one entry, so a single undo wiped out a whole sentence instead of
    // the most recent action. A correction after typing should be its own
    // undo step.
    test('undo after a correction reverts only the correction, not the whole run (#3825)', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await slowType(page, 'hello world');
        // A correction is a deliberate, separate action — let the typed run
        // commit (History batches per animation frame) before deleting.
        await page.waitForTimeout(80);
        await page.keyboard.press('Backspace');
        await expect(para).toContainText('hello worl');

        await page.evaluate(() => window.muya!.undo());
        // Only the deletion is undone — the full typed text comes back.
        await expect(para).toContainText('hello world');
        expect(await getMarkdown(page)).toContain('hello world');
    });

    test('typed words split into separate undo steps (#3825)', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await slowType(page, 'hello world');
        await expect(para).toContainText('hello world');

        // First undo drops the second word only.
        await page.evaluate(() => window.muya!.undo());
        await expect(para).not.toContainText('world');
        await expect(para).toContainText('hello');

        // Second undo drops the first word.
        await page.evaluate(() => window.muya!.undo());
        await expect(para).not.toContainText('hello');
    });
});
