import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

test('list spacing follows a structural edit, undo, redo, and reopen (#5297)', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- a\n- c\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after', 'b');
        muya.flush();
    });
    const list = page.locator(editor.bulletList).first();
    await expect(list).not.toHaveClass(/mu-tight-list/);
    const saved = await page.evaluate(() => window.muya!.getMarkdown());
    expect(saved).toBe('- a\n\n  b\n\n- c\n');

    await page.evaluate(() => window.muya!.undo());
    await expect(list).toHaveClass(/mu-tight-list/);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- a\n- c\n');
    await page.evaluate(() => window.muya!.redo());
    await expect(list).not.toHaveClass(/mu-tight-list/);
    await page.evaluate(markdown => window.muya!.setContent(markdown), saved);
    await expect(list).not.toHaveClass(/mu-tight-list/);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(saved);
});

test('Enter stays tight and joining items updates the whole list (#5297)', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('- a\n- c\n'));
    await page.locator(editor.paragraphContent).first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const list = page.locator(editor.bulletList).first();
    await expect(list).toHaveClass(/mu-tight-list/);
    await page.keyboard.press('Backspace');
    await page.keyboard.type('b');
    await expect(page.locator(editor.paragraphContent).filter({ hasText: 'b' })).toHaveCount(1);
    await page.evaluate(() => window.muya!.flush());
    await expect(list).not.toHaveClass(/mu-tight-list/);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toContain('  b');
});

test('typing into an empty final paragraph updates spacing in a later transaction (#5297)', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- a\n- c\n');
        muya.editor.scrollPage!.lastContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after');
        muya.flush();
    });
    const list = page.locator(editor.bulletList).first();
    await expect(list).toHaveClass(/mu-tight-list/);
    await page.keyboard.type('b');
    await expect(page.locator(editor.paragraphContent).filter({ hasText: 'b' })).toHaveCount(1);
    await page.evaluate(() => window.muya!.flush());
    await expect(list).not.toHaveClass(/mu-tight-list/);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- a\n\n- c\n\n  b\n');
});
