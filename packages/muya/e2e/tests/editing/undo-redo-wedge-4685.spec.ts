import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #4685: redo after a cross-block paragraph -> ATX heading -> bullet list
// sequence threw an unhandled renderer error, corrupted the document, and
// could leave History._ignoreChange stuck true so later edits were never
// recorded (Undo permanently dead).
test.describe('#4685 redo after cross-block edits', () => {
    test('redo restores content without crashing and Undo keeps working', async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.evaluate(() => window.muya!.setContent('start'));
        const root = page.locator(editor.root);
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.press('End');

        await page.keyboard.press('Enter');
        await slowType(page, '# heading');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await slowType(page, '- list item');

        await expect(root.locator(editor.atxHeading)).toContainText('heading');
        await expect(root.locator(editor.bulletList)).toContainText('list item');

        // Undo all the way back to "start".
        for (let i = 0; i < 20; i++) {
            const md = await getMarkdown(page);
            if (md.trim() === 'start')
                break;
            await page.evaluate(() => window.muya!.undo());
        }
        expect((await getMarkdown(page)).trim()).toBe('start');

        // Redo many times — the reported crash path.
        for (let i = 0; i < 15; i++)
            await page.evaluate(() => window.muya!.redo());

        const redone = await getMarkdown(page);
        expect(pageErrors, `renderer errors: ${pageErrors.join(' | ')}`).toEqual([]);
        expect(redone).toContain('# heading');
        expect(redone).toContain('- list item');

        // History must not be wedged: a fresh edit has to be undoable.
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.press('End');
        await slowType(page, ' MORE');
        await expect(page.locator(editor.paragraph).first()).toContainText('start MORE');

        await page.evaluate(() => window.muya!.undo());
        await expect(page.locator(editor.paragraph).first()).not.toContainText('MORE');
        expect(pageErrors, `renderer errors: ${pageErrors.join(' | ')}`).toEqual([]);
    });
});
