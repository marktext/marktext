import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor, toolbar } from '../helpers/selectors';

for (const existingMatch of [true, false]) {
    test(`spaces after a newly typed search match (existing match: ${existingMatch}) (#6026)`, async ({ page }) => {
        await page.evaluate((existing) => {
            window.muya!.setContent(existing ? 'test\n\nprefix' : 'prefix');
        }, existingMatch);
        await page.locator(toolbar.search).fill('test');
        const paragraph = page.locator(editor.paragraphContent).last();
        await paragraph.click();
        await page.evaluate(() => {
            const block = window.muya!.editor.activeContentBlock!;
            block.setCursor(block.text.length, block.text.length);
        });
        await slowType(page, ' test');
        await expect(paragraph.locator('.mu-highlight, .mu-selection')).toHaveText('test');

        const snapshot = () => page.evaluate(() => {
            window.muya!.flush();
            const block = window.muya!.editor.activeContentBlock!;
            const selection = window.muya!.getSelectionState();
            return {
                text: block.text,
                offset: selection?.kind === 'text' ? selection.focus.offset : null,
            };
        });

        await expect.poll(snapshot).toEqual({ text: 'prefix test', offset: 11 });
        for (let spaces = 1; spaces <= 3; spaces++) {
            await page.keyboard.press('Space');
            await expect.poll(snapshot).toEqual({ text: `prefix test${' '.repeat(spaces)}`, offset: 11 + spaces });
        }
        await slowType(page, 'next word');
        await expect.poll(snapshot).toEqual({ text: 'prefix test   next word', offset: 23 });
    });
}
