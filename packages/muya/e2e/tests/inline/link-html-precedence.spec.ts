import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

for (const source of ['[<b>x](</b>)', '[<b>x](/b)</b>', '[<b>x][ref]</b>\n\n[ref]: /b']) {
    test(`HTML outside link text preserves the link in ${source}`, async ({ page }) => {
        await page.evaluate(source => window.muya!.setContent(source), source);
        for (const readOnly of [false, true]) {
            await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
            const link = page.locator(editor.link);
            await expect(link).toHaveCount(1);
            if (readOnly)
                await expect(link).toHaveAttribute('href', /\/b$/);
            expect(await getMarkdown(page)).toBe(`${source}\n`);
        }
    });
}

test('HTML and code that contain the closing bracket still prevent a link', async ({ page }) => {
    const source = '[foo <bar attr="](baz)">\n\n[not a `link](/foo`)';
    await page.evaluate(source => window.muya!.setContent(source), source);
    await expect(page.locator(editor.link)).toHaveCount(0);
    await expect(page.locator(editor.inlineCode)).toHaveCount(1);
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});
