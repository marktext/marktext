import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

test('Delete on a new empty nested item removes it and leaves the next item at its depth', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('- a\n  - x\n- b\n'));
    await page.locator(editor.paragraphContent).filter({ hasText: 'x' }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Delete');
    await page.keyboard.type('z');
    await page.evaluate(() => window.muya!.flush());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- a\n  - x\n- zb\n');
});

test('Delete on an empty last item removes it and keeps the caret at the end of the previous line', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('- a\n- b\n'));
    await page.locator(editor.paragraphContent).filter({ hasText: 'b' }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Delete');
    await page.keyboard.type('c');
    await page.evaluate(() => window.muya!.flush());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- a\n- bc\n');
});
