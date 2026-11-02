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
