// @ts-expect-error commonmark-spec has no TypeScript declaration.
import cms from 'commonmark-spec';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

const reported = new Set([493, 494, 503, 506, 510, 513, 515, 518, 519, 520, 528, 529, 532, 533, 540, 541, 550, 552, 556]);
const examples = (cms.tests as { number: number; markdown: string; html: string }[])
    .filter(example => reported.has(example.number));

for (const sample of examples) {
    test(`CommonMark ${sample.number} renders in editing and reading modes (#5979)`, async ({ page }) => {
        const expected = await page.evaluate((html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'), link => ({
                href: link.getAttribute('href'),
                title: link.getAttribute('title') ?? '',
            }));
        }, sample.html);
        await page.evaluate(source => window.muya!.setContent(source), sample.markdown);
        const markdown = await getMarkdown(page);
        for (const readOnly of [false, true, false]) {
            await page.evaluate(readOnly => window.muya!.setReadOnly(readOnly), readOnly);
            if (sample.number === 520) {
                await expect(page.locator(editor.image)).toHaveCount(1);
                await expect(page.locator(editor.image)).toHaveAttribute('data-raw', sample.markdown.trimEnd());
            }
            const links = page.locator(editor.link);
            await expect(links).toHaveCount(expected.length);
            for (let i = 0; i < expected.length; i++) {
                const link = links.nth(i);
                const href = readOnly
                    ? await link.getAttribute('href')
                    : await link.evaluate(node => node.getAttribute('href') ?? Reflect.get(node, 'href'));
                expect(new URL(href, 'https://example.test').href).toBe(new URL(expected[i].href!, 'https://example.test').href);
                expect(await link.evaluate(node => node.getAttribute('title') ?? Reflect.get(node, 'title') ?? '')).toBe(expected[i].title);
            }
            expect(await getMarkdown(page)).toBe(markdown);
        }
        await page.evaluate(source => window.muya!.setContent(source), markdown);
        expect(await getMarkdown(page)).toBe(markdown);
        if (sample.number === 520) {
            // Extensionless local paths use a placeholder; a loadable URL exercises rendered alt text.
            await page.route('https://example.test/outer.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
            await page.evaluate(source => window.muya!.setContent(source.replace('(uri3)', '(https://example.test/outer.png)')), sample.markdown);
            const image = page.locator(`${editor.paragraph} img`);
            await expect(image).toHaveCount(1);
            await expect(image).toHaveAttribute('alt', '[foo](uri2)');
        }
    });
}

test('editing a nested link updates parsing and survives undo/redo (#5979)', async ({ page }) => {
    const source = '[outer [inner](/inner)](/outer)\n';
    await page.evaluate((source) => {
        const muya = window.muya!;
        muya.setContent(source);
        const block = muya.editor.scrollPage!.firstChild!.firstContentInDescendant()!;
        muya.editor.selection.setSelection({
            kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
            anchor: { path: block.path, offset: 7 },
            focus: { path: block.path, offset: 7 },
        });
    }, source);
    await expect(page.locator(editor.link)).toHaveCount(1);
    await page.keyboard.press('Delete');
    const changed = '[outer inner](/inner)](/outer)\n';
    await expect.poll(() => getMarkdown(page)).toBe(changed);
    await expect(page.locator(editor.link)).toHaveCount(1);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(source);
    await expect(page.locator(editor.link)).toHaveCount(1);
    await page.evaluate(() => window.muya!.redo());
    await expect.poll(() => getMarkdown(page)).toBe(changed);
});
