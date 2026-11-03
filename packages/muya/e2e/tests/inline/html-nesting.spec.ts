import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test('4000 HTML wrappers remain renderable and editable', async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const source = 'before ' + '<span>'.repeat(4000) + 'x' + '</span>'.repeat(4000) + ' after';
    await page.evaluate(source => {
        window.muya!.setContent(`${source}\n\nOther paragraph.`);
        const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(7 + 4000 * 6, 7 + 4000 * 6, true);
    }, source);
    await page.keyboard.type('X');
    const edited = source.replace('x</span>', 'Xx</span>');
    await expect.poll(() => getMarkdown(page)).toBe(`${edited}\n\nOther paragraph.\n`);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    await page.evaluate(() => {
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(8 + 4000 * 6, 8 + 4000 * 6, true);
    });
    await page.keyboard.press('Tab');
    const offset = await page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.getCursor()!.start.offset);
    expect(offset).toBe(8 + 4000 * 6 + '</span>'.length);
    for (const readOnly of [true, false]) {
        await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
        expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    }
    expect(errors).toEqual([]);
});

test('a link destination cannot close its containing HTML', async ({ page }) => {
    const source = 'before <span><span>x</span>[link](</span>) tail</span>';
    await page.evaluate(source => window.muya!.setContent(source), source);
    const link = page.locator(editor.link);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', /\/span$/);
    await expect(link).toHaveText('link');
    await expect(page.locator(editor.rawHtml).first()).toContainText('tail');
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});
