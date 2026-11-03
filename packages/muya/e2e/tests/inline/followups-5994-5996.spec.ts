import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test('Unicode symbols follow CommonMark emphasis boundaries (#5994)', async ({ page }) => {
    const source = '*£*bravo. *€*charlie. *😀*word\n\n*£* word\n\n中文**"加粗"**中文';
    await page.evaluate(source => window.muya!.setContent(source), source);
    await page.evaluate(() => window.muya!.setReadOnly(true));
    const paragraphs = page.locator(editor.paragraphContent);
    await expect(paragraphs.nth(0).locator('em')).toHaveCount(0);
    await expect(paragraphs.nth(1).locator('em')).toHaveText('£');
    await expect(paragraphs.nth(2).locator('strong')).toHaveText('"加粗"');
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

for (const character of ['𫝀', '𬺰']) {
    test(`retains supplementary CJK emphasis next to ${character}`, async ({ page }) => {
        const source = `${character}**"加粗"**${character}`;
        await page.evaluate(source => window.muya!.setContent(source), source);
        await expect(page.locator(`${editor.root} strong`)).toHaveCount(1);
        await page.evaluate(() => window.muya!.setReadOnly(true));
        await expect(page.locator(`${editor.root} strong`)).toHaveText('"加粗"');
        expect(await getMarkdown(page)).toBe(`${source}\n`);
    });
}

test('terminal spaces remain editable through deletion and undo (#5995)', async ({ page }) => {
    const source = 'foo  \n\nOther paragraph.';
    await page.evaluate(source => window.muya!.setContent(source), source);
    const first = page.locator(editor.paragraphContent).first();
    const whitespace = first.locator('.mu-remove');
    await page.locator(editor.paragraphContent).nth(1).click();
    await expect(whitespace).toHaveText('  ');
    await expect(whitespace).toHaveClass(/mu-hide/);
    expect(await whitespace.evaluate(element => getComputedStyle(element).fontSize)).toBe('0px');
    await page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(5, 5, true));
    await expect(whitespace).toHaveClass(/mu-gray/);
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('foo \n\nOther paragraph.\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(`${source}\n`);
    expect(await page.evaluate(() => window.muya!.getSelection()?.kind === 'text'
        ? window.muya!.editor.selection.getTextSelection()?.anchor.offset : null)).toBe(5);
    await page.evaluate(() => window.muya!.setReadOnly(true));
    await expect(whitespace).toHaveClass(/mu-hide/);
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

test('bare domains, FTP and email link without sentence periods (#5996)', async ({ page }) => {
    const source = 'Visit www.commonmark.org.\n\nftp://foo.bar.baz.\n\na.b-c_d@a.b.\n\na.b-c_d@a.b-\n\na.b-c_d@a.b_';
    await page.evaluate(source => window.muya!.setContent(source), source);
    for (const readOnly of [false, true]) {
        await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
        const links = page.locator(`${editor.root} a`);
        await expect(links).toHaveCount(3);
        for (const [index, href, label] of [
            [0, 'http://www.commonmark.org', 'www.commonmark.org'],
            [1, 'ftp://foo.bar.baz', 'ftp://foo.bar.baz'],
            [2, 'mailto:a.b-c_d@a.b', 'a.b-c_d@a.b'],
        ] as const) {
            await expect(links.nth(index)).toHaveAttribute('href', href);
            await expect(links.nth(index)).toHaveText(label);
        }
        expect(await getMarkdown(page)).toBe(`${source}\n`);
    }
});
