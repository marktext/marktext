import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

const image = 'https://example.test/outer.png';
const inner = 'https://example.test/inner.png';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const cases = [
    { name: 'nested image (CM 574)', source: `![foo ![bar](${inner})](${image})`, alt: 'foo bar' },
    { name: 'nested link (CM 575)', source: `![foo [bar](${inner})](${image})`, alt: 'foo bar' },
    { name: 'shortcut reference (CM 573)', source: `![foo *bar*]\n\n[foo *bar*]: ${image} "train & tracks"`, alt: 'foo bar', title: 'train & tracks' },
    { name: 'collapsed reference (CM 576)', source: `![foo *bar*][]\n\n[foo *bar*]: ${image} "train & tracks"`, alt: 'foo bar', title: 'train & tracks' },
    { name: 'full reference (CM 577)', source: `![foo *bar*][foobar]\n\n[FOOBAR]: ${image} "train & tracks"`, alt: 'foo bar', title: 'train & tracks' },
    { name: 'leading emphasis (CM 585)', source: `![*foo* bar][]\n\n[*foo* bar]: ${image} "title"`, alt: 'foo bar', title: 'title' },
    { name: 'reference before soft break (CM 587)', source: `![foo] \n[]\n\n[foo]: ${image} "title"`, alt: 'foo', title: 'title' },
    { name: 'shortcut with leading emphasis (CM 589)', source: `![*foo* bar]\n\n[*foo* bar]: ${image} "title"`, alt: 'foo bar', title: 'title' },
    { name: 'literal punctuation and code', source: `![v1.2 + x_y & \`a*b\` \\*stars\\*](${image})`, alt: 'v1.2 + x_y & a*b *stars*' },
    { name: 'HTML image punctuation', source: `before <img src="${image}" alt="v1.2 + x_y &amp; a*b *stars*"> after`, alt: 'v1.2 + x_y & a*b *stars*' },
];

for (const sample of cases) {
    test(`${sample.name} renders and round-trips (#5981)`, async ({ page }) => {
        await page.route('**/example.test/**', route => route.fulfill({ contentType: 'image/png', body: png }));
        await page.evaluate(source => window.muya!.setContent(`${source}\n\nafter`), sample.source);
        const rendered = page.locator(`${editor.paragraph} img`);
        await expect(rendered).toHaveCount(1);
        await expect(rendered).toHaveAttribute('src', image);
        await expect(rendered).toHaveAttribute('alt', sample.alt);
        if (sample.title)
            await expect(rendered).toHaveAttribute('title', sample.title);
        expect(await page.evaluate(() => {
            window.muya!.flush();
            return window.muya!.getMarkdown();
        })).toContain(sample.source);

        await page.evaluate(source => window.muya!.setContent(`${source}\n\nchanged`), sample.source);
        await expect(rendered).toHaveCount(1);
        await expect(rendered).toHaveAttribute('src', image);
        await expect(rendered).toHaveAttribute('alt', sample.alt);
        if (sample.title)
            await expect(rendered).toHaveAttribute('title', sample.title);
    });
}

test('changing the image URL preserves the source description (#5981)', async ({ page }) => {
    await page.route('**/example.test/**', route => route.fulfill({ contentType: 'image/png', body: png }));
    await page.evaluate(() => window.muya!.setContent('![foo *bar*]()'));
    await page.locator(editor.emptyImage).click();
    const sourceInput = page.locator(`${floats.imageEditTool} input.src`);
    await sourceInput.fill(image);
    await sourceInput.press('Enter');
    await expect(page.locator(`${editor.paragraph} img`)).toHaveAttribute('alt', 'foo bar');
    expect(await page.evaluate(() => {
        window.muya!.flush();
        return window.muya!.getMarkdown();
    })).toBe(`![foo *bar*](${image})\n`);
});

for (const [destination, src] of [
    [String.raw`https://example.test/a\&copy;.png`, 'https://example.test/a&copy;.png'],
    ['https://example.test/a&Tab;.png', 'https://example.test/a\t.png'],
    ['https://example.test/a&NewLine;.png', 'https://example.test/a\n.png'],
]) {
    test(`editing only an image title preserves its URL: ${destination}`, async ({ page }) => {
        await page.route('**/example.test/**', route => route.fulfill({ contentType: 'image/png', body: png }));
        const source = `![alt](${destination} "old")\n`;
        await page.evaluate(source => window.muya!.setContent(source), source);
        const rendered = page.locator(`${editor.paragraph} img`);
        await expect(rendered).toHaveAttribute('src', src);
        await page.locator(editor.image).click();
        await page.locator(`${floats.imageToolbar} li.edit`).click();
        const tool = page.locator(floats.imageEditTool);
        await tool.locator('.description a').click();
        const titleInput = tool.locator('input.title');
        // Text inputs strip CR/LF; title-only edits must still retain the original destination.
        await expect(tool.locator('input.src')).toHaveValue(src.replace(/[\r\n]/g, ''));
        await titleInput.fill('new');
        await titleInput.press('Enter');
        await expect(rendered).toHaveAttribute('title', 'new');
        await expect(rendered).toHaveAttribute('src', src);
        const changed = await page.evaluate(() => { window.muya!.flush(); return window.muya!.getMarkdown(); });

        await page.evaluate(() => window.muya!.undo());
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(source);
        await expect(rendered).toHaveAttribute('src', src);
        await expect(rendered).toHaveAttribute('title', 'old');
        await page.evaluate(() => window.muya!.redo());
        await expect(rendered).toHaveAttribute('src', src);
        await expect(rendered).toHaveAttribute('title', 'new');

        await page.evaluate(source => window.muya!.setContent(source), changed);
        await expect(rendered).toHaveAttribute('src', src);
        await expect(rendered).toHaveAttribute('title', 'new');
    });
}

for (const src of ['https://example.test/a&copy;.png', 'https://example.test/a.png?x=1&copy;']) {
    test(`HTTP image insertion preserves literal entity text in ${src}`, async ({ page }) => {
        const requested: string[] = [];
        await page.route('**/example.test/**', (route) => {
            requested.push(route.request().url());
            return route.fulfill({ contentType: 'image/png', body: png });
        });
        await page.evaluate((src) => {
            const muya = window.muya!;
            muya.setContent('before\n');
            const block = muya.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(block.text.length, block.text.length, true);
            muya.transact(() => muya.insertImage({ src, alt: 'alt' }));
        }, src);
        const rendered = page.locator(`${editor.paragraph} img`);
        await expect(rendered).toHaveAttribute('src', src);
        await expect.poll(() => requested).toContain(src);
        await page.evaluate(() => window.muya!.undo());
        await expect(rendered).toHaveCount(0);
        await page.evaluate(() => window.muya!.redo());
        await expect(rendered).toHaveAttribute('src', src);
    });
}

for (const [encoded, title] of [
    ['a &quot;b&quot;', 'a "b"'],
    ['&amp;quot; &amp;#34;', '&quot; &#34;'],
    [String.raw`a \"b\" \\`, 'a "b" \\'],
]) {
    test(`editing an image URL preserves title ${encoded} through undo and redo`, async ({ page }) => {
        await page.route('**/example.test/**', route => route.fulfill({ contentType: 'image/png', body: png }));
        const source = `![foo *bar*](<> "${encoded}")\n`;
        await page.evaluate(source => window.muya!.setContent(source), source);
        await page.locator(editor.emptyImage).click();
        const sourceInput = page.locator(`${floats.imageEditTool} input.src`);
        await sourceInput.fill(image);
        await sourceInput.press('Enter');
        const rendered = page.locator(`${editor.paragraph} img`);
        await expect(rendered).toHaveAttribute('title', title);
        await expect(rendered).toHaveAttribute('alt', 'foo bar');
        const changed = await page.evaluate(() => { window.muya!.flush(); return window.muya!.getMarkdown(); });

        await page.evaluate(() => window.muya!.undo());
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(source);
        await page.evaluate(() => window.muya!.redo());
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(changed);
        await expect(rendered).toHaveAttribute('title', title);

        await page.evaluate(source => window.muya!.setContent(source), changed);
        await expect(rendered).toHaveAttribute('title', title);
    });
}
