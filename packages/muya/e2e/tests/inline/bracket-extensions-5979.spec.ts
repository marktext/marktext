import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

for (const [option, formula] of [
    ['texMathDollars', '$[x](y)$'],
    ['texMathGfm', '$`[x](y)`$'],
    ['texMathSingleBackslash', String.raw`\([x](y)\)`],
    ['texMathSingleBackslash', String.raw`\[[x](y)\]`],
    ['texMathDoubleBackslash', String.raw`\\([x](y)\\)`],
    ['texMathDoubleBackslash', String.raw`\\[[x](y)\\]`],
] as const) {
    test(`${option} formula ${formula} preserves its enclosing link`, async ({ page }) => {
        const source = `[see ${formula}](/target)`;
        await page.evaluate(({ source, option }) => {
            window.muya!.setOptions({
                texMathDollars: false,
                texMathGfm: false,
                texMathSingleBackslash: false,
                texMathDoubleBackslash: false,
                [option]: true,
            });
            window.muya!.setContent(source);
            window.muya!.setReadOnly(true);
        }, { source, option });
        await expect(page.locator(editor.link)).toHaveCount(1);
        await expect(page.locator(editor.link)).toHaveAttribute('href', '/target');
        await expect(page.locator(editor.link).locator(editor.inlineMath)).toHaveCount(1);
        expect(await getMarkdown(page)).toBe(`${source}\n`);
    });
}

test('disabling dollar math restores CommonMark nested-link precedence', async ({ page }) => {
    const source = '[see $[x](y)$](/target)';
    await page.evaluate((source) => {
        window.muya!.setOptions({ texMathDollars: false });
        window.muya!.setContent(source);
        window.muya!.setReadOnly(true);
    }, source);
    await expect(page.locator(editor.link)).toHaveCount(1);
    await expect(page.locator(editor.link)).toHaveAttribute('href', 'y');
    await expect(page.locator(editor.inlineMath)).toHaveCount(0);
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

for (const [diff, selector] of [['[+added+]', editor.inlineDiffAddition], ['[-removed-]', editor.inlineDiffDeletion]]) {
    for (const tail of ['(url)', '[ref]']) {
        test(`${diff}${tail} keeps diff precedence when enabled`, async ({ page }) => {
            const source = `${diff}${tail}\n\n[ref]: /target`;
            await page.evaluate((source) => {
                window.muya!.setOptions({ inlineDiff: true });
                window.muya!.setContent(source);
            }, source);
            await expect(page.locator(selector)).toHaveCount(1);
            await expect(page.locator(editor.link)).toHaveCount(tail === '[ref]' ? 1 : 0);
            const markdown = await getMarkdown(page);
            await page.evaluate((source) => {
                window.muya!.setOptions({ inlineDiff: false });
                window.muya!.setContent(source);
            }, markdown);
            await expect(page.locator(selector)).toHaveCount(0);
            await expect(page.locator(editor.link)).toHaveCount(1);
            expect(await getMarkdown(page)).toBe(markdown);
        });
    }
}

test('5000 nested images render the outer image and retain their source', async ({ page }) => {
    await page.route('https://example.test/outer.png', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }));
    const source = `${'!['.repeat(5000)}x${'](a.png)'.repeat(4999)}](https://example.test/outer.png)`;
    const elapsed = await page.evaluate((source) => {
        const start = performance.now();
        window.muya!.setContent(source);
        window.muya!.flush();
        return performance.now() - start;
    }, source);
    expect(elapsed).toBeLessThan(2000);
    await expect(page.locator(editor.image)).toHaveCount(1);
    await expect(page.locator(`${editor.paragraph} img`)).toHaveAttribute('alt', 'x');
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});
