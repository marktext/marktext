import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

const cases = [
    { id: 329, source: '`` foo ` bar ``', content: 'foo ` bar' },
    { id: 330, source: '` `` `', content: '``' },
    { id: 331, source: '`  ``  `', content: ' `` ' },
    { id: 335, source: '``\nfoo\nbar  \nbaz\n``', content: 'foo bar   baz' },
    { id: 336, source: '``\nfoo \n``', content: 'foo ' },
    { id: 337, source: '`foo   bar \nbaz`', content: 'foo   bar  baz' },
    { id: 340, source: '` foo `` bar `', content: 'foo `` bar' },
    { id: 342, source: '[not a `link](/foo`)', content: 'link](/foo' },
    { id: 349, source: '`foo``bar``', content: 'bar' },
    { id: 640, source: '`code  \nspan`', content: 'code   span' },
    { id: 641, source: '`code\\\nspan`', content: 'code\\ span' },
];

for (const { id, source, content } of cases) {
    test(`CommonMark ${id} renders normalized code and retains Markdown`, async ({ page }) => {
        await page.evaluate(source => window.muya!.setContent(`${source}\n\nOther paragraph.`), source);
        const code = page.locator(editor.inlineCode);
        await expect(code).toHaveCount(1);
        for (const readOnly of [false, true]) {
            await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
            const sizes = await code.evaluate((element, content) => {
                const reference = element.cloneNode(false) as HTMLElement;
                reference.textContent = content;
                element.after(reference);
                const actual = element.getBoundingClientRect();
                const expected = reference.getBoundingClientRect();
                reference.remove();
                return { actual: [actual.width, actual.height], expected: [expected.width, expected.height] };
            }, content);
            expect(sizes.actual[0]).toBeCloseTo(sizes.expected[0], 0);
            expect(sizes.actual[1]).toBeCloseTo(sizes.expected[1], 0);
            expect(await getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
        }
    });
}

test('CommonMark 347 keeps unequal backtick runs literal', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('```foo``'));
    await expect(page.locator(editor.inlineCode)).toHaveCount(0);
    await expect(page.locator(editor.paragraphContent)).toHaveText('```foo``');
    expect(await getMarkdown(page)).toBe('```foo``\n');
});

test('editing normalized code keeps source offsets through input and undo', async ({ page }) => {
    const source = '``\nfoo\nbar  \nbaz\n``';
    await page.evaluate(source => {
        window.muya!.setContent(`${source}\n\nOther paragraph.`);
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(6, 6, true);
    }, source);
    await expect(page.locator(editor.paragraphContent).first()).toHaveText(source);
    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toBe('``\nfooX\nbar  \nbaz\n``\n\nOther paragraph.\n');
    expect(await page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.offset)).toBe(7);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(`${source}\n\nOther paragraph.\n`);
    await page.locator(editor.paragraphContent).nth(1).click();
    await expect(page.locator(editor.paragraphContent).first()).toHaveText(source);
    await page.locator(editor.inlineCode).click();
    await page.keyboard.type('Y');
    expect((await getMarkdown(page)).replace('Y', '')).toBe(`${source}\n\nOther paragraph.\n`);
});
