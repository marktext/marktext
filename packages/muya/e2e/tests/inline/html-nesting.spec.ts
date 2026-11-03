import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test.describe('4000 HTML wrappers', () => {
    test.describe.configure({ mode: 'default' });
    const source = `before ${'<span>'.repeat(4000)}x${'</span>'.repeat(4000)} after`;
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        test.setTimeout(60_000);
        errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.evaluate(source => window.muya!.setContent(`${source}\n\nOther paragraph.`), source);
    });

    test.afterEach(() => {
        expect(errors).toEqual([]);
    });

    test('editing and undo preserve the source', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(7 + 4000 * 6, 7 + 4000 * 6, true);
        });
        await page.keyboard.type('X');
        const edited = source.replace('x</span>', 'Xx</span>');
        await expect.poll(() => getMarkdown(page)).toBe(`${edited}\n\nOther paragraph.\n`);
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    });

    test('Tab exits the innermost wrapper', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(8 + 4000 * 6, 8 + 4000 * 6, true);
        });
        await page.keyboard.press('Tab');
        const offset = await page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.getCursor()!.start.offset);
        expect(offset).toBe(8 + 4000 * 6 + '</span>'.length);
        expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    });

    test('reading and editing modes preserve the source', async ({ page }) => {
        for (const readOnly of [true, false]) {
            await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
            expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
        }
    });
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
