import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test('the first undo after loading restores the caret in the edited paragraph', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('first\n\nsecond\n'));
    await page.locator(editor.paragraph).nth(1).click();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => page.evaluate(() => {
        const selection = window.muya!.editor.selection.getSelection();
        return { path: selection?.anchor.path, offset: selection?.anchor.offset };
    })).toEqual({ path: [1, 'text'], offset: 5 });

    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toBe('first\n\nseconXd\n');
    await expect.poll(() => page.evaluate(() => window.muya!.getHistory().stack.undo.length)).toBe(1);
    await page.evaluate(() => window.muya!.undo());

    await expect.poll(() => getMarkdown(page)).toBe('first\n\nsecond\n');
    await expect.poll(() => page.evaluate(() => {
        const selection = window.muya!.editor.selection.getSelection();
        return {
            anchor: selection && { path: selection.anchor.path, offset: selection.anchor.offset },
            focus: selection && { path: selection.focus.path, offset: selection.focus.offset },
        };
    })).toEqual({
        anchor: { path: [1, 'text'], offset: 5 },
        focus: { path: [1, 'text'], offset: 5 },
    });
    await page.keyboard.type('Y');
    await expect.poll(() => getMarkdown(page)).toBe('first\n\nseconYd\n');
});
