import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown, slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5373: after one edit failed to apply to the json state, every later edit
// threw again and none of them reached the saved document.

test('edits after a failed flush are still saved (#5373)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await loadMarkdown(page, 'first paragraph\n\nsecond paragraph\n');

    // The json state loses a block the editor still shows, the drift behind
    // #4903 and #5148.
    await page.evaluate(() => {
        window.muya!.editor.jsonState.removeOperation([1]);
        window.muya!.flush();
    });
    expect(await getMarkdown(page)).toBe('first paragraph\n');

    await page.locator(editor.paragraphContent).nth(1).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await slowType(page, 'third');
    await expect.poll(() => getMarkdown(page)).toBe('first paragraph\n\nsecond paragraph\n\nthird\n');

    await page.locator(editor.paragraphContent).first().click();
    await page.keyboard.press('End');
    await slowType(page, ' edited');
    await expect.poll(() => getMarkdown(page)).toBe('first paragraph edited\n\nsecond paragraph\n\nthird\n');

    expect(errors).toEqual(['Cannot insert into out of bounds index']);
});
