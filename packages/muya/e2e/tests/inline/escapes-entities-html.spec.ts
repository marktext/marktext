import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test('entities display decoded characters while source remains editable (#5977)', async ({ page }) => {
    const source = '&Dcaron; &HilbertSpace; &ngE; &#35; &#0; &#X22; &#9;';
    await page.evaluate(source => window.muya!.setContent(`${source}\n\nOther paragraph.`), source);
    const entities = page.locator(editor.htmlEscape);
    await expect(entities).toHaveCount(7);
    for (const readOnly of [false, true]) {
        await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
        expect(await entities.evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.character)))
            .toEqual(['Ď', 'ℋ', '≧̸', '#', '�', '"', '\t']);
        expect(await entities.first().evaluate(element => getComputedStyle(element, '::before').content)).toBe('"Ď"');
        expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    }
});

test('escaped entity openers and code remain literal (#5982)', async ({ page }) => {
    const source = '\\&ouml; `&ouml; &#35; \\*`';
    await page.evaluate(source => window.muya!.setContent(`${source}\n\nOther paragraph.`), source);
    await expect(page.locator(editor.htmlEscape)).toHaveCount(0);
    await expect(page.locator(editor.inlineCode)).toHaveText('&ouml; &#35; \\*');
    expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
});

test('inline and reference links use decoded destinations and titles (#5977, #5982)', async ({ page }) => {
    const source = '[inline](/f&ouml;&ouml; "ti\\*tle") [ref]\n\n[ref]: /bar\\* "f&ouml;&ouml;"';
    await page.evaluate(source => window.muya!.setContent(source), source);
    await page.evaluate(() => window.muya!.setReadOnly(true));
    const links = page.locator(editor.link);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', '/föö');
    await expect(links.nth(0)).toHaveAttribute('title', 'ti*tle');
    await expect(links.nth(1)).toHaveAttribute('href', /\/bar\*$/);
    await expect(links.nth(1)).toHaveAttribute('title', 'föö');
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

test('HTML quotes own angle brackets and invalid attributes stay literal (#5980)', async ({ page }) => {
    const source = 'before <span title="x <em> &Dcaron;">body</span> <a h*#ref="hi"> <a href=\'bar\'title=title>';
    await page.evaluate(source => window.muya!.setContent(`${source}\n\nOther paragraph.`), source);
    const html = page.locator(editor.rawHtml);
    await expect(html).toHaveCount(1);
    await expect(html).toHaveAttribute('title', 'x <em> Ď');
    await expect(html).toHaveText('body');
    await expect(html.locator('em')).toHaveCount(0);
    expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
});

test('recognized raw HTML still filters unsafe elements and attributes', async ({ page }) => {
    const source = 'before <span onclick="alert(1)">safe</span> <script>alert(1)</script> <?php echo $a; ?> </img>';
    await page.evaluate(source => window.muya!.setContent(source), source);
    await expect(page.locator(`${editor.root} script, ${editor.root} [onclick], ${editor.root} img`)).toHaveCount(0);
    await expect(page.locator(editor.rawHtml)).toHaveText('safe');
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

test('editing an entity preserves source offsets through undo', async ({ page }) => {
    const source = 'x &HilbertSpace; y';
    await page.evaluate(source => {
        window.muya!.setContent(`${source}\n\nOther paragraph.`);
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
    }, source);
    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toBe('x &HXilbertSpace; y\n\nOther paragraph.\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    await page.locator(editor.paragraphContent).nth(1).click();
    await expect(page.locator(editor.htmlEscape)).toHaveAttribute('data-character', 'ℋ');
});
