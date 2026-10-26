import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const cases = [
    { name: 'link', source: '[text](https://example.com)', selector: '.mu-link' },
    { name: 'link title', source: '[text](https://example.com "title")', selector: '.mu-link' },
    { name: 'strong', source: '**text**', selector: 'strong' },
    { name: 'emphasis', source: '*text*', selector: 'em' },
    { name: 'strikethrough', source: '~~text~~', selector: 'del' },
    { name: 'highlight', source: '==text==', selector: 'mark' },
    { name: 'code', source: '`text`', selector: 'code' },
    { name: 'multi-backtick code', source: '``a`b``', selector: 'code' },
    { name: 'superscript', source: '^text^', selector: 'sup' },
    { name: 'subscript', source: '~text~', selector: 'sub' },
    { name: 'diff addition', source: '{+text+}', selector: 'ins' },
    { name: 'diff deletion', source: '{-text-}', selector: 'del' },
    { name: 'email autolink', source: '<me@example.com>', selector: '.mu-auto-link' },
    { name: 'plain autolink', source: 'https://example.com', selector: '.mu-auto-link-extension' },
    { name: 'autolink', source: '<https://example.com>', selector: '.mu-auto-link' },
    { name: 'reference link', source: '[text][ref]', selector: '.mu-reference-link' },
    { name: 'collapsed reference', source: '[ref][]', selector: '.mu-reference-link' },
    { name: 'shortcut reference', source: '[ref]', selector: '.mu-reference-link' },
    { name: 'HTML', source: '<kbd>text</kbd>', selector: '.mu-raw-html' },
    { name: 'footnote', source: '[^note]', selector: '.mu-inline-footnote-identifier' },
    { name: 'nested formatting', source: '**_text_**', selector: 'strong' },
    { name: 'formatted link', source: '[**text**](https://example.com)', selector: '.mu-link' },
];

async function setup(page: Page, source: string, atEnd: boolean) {
    await page.evaluate(({ source, atEnd }) => {
        window.muya!.setOptions({ highlightSyntax: true, inlineDiff: true, texMathGfm: true, texMathSingleBackslash: true, texMathDoubleBackslash: true });
        window.muya!.setContent(`Before ${source}${atEnd ? '' : ' after'}\n\nNext paragraph.\n\n[ref]: https://example.com\n\n[^note]: footnote\n\n[pic]: https://example.test/pixel.png`);
        const first = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        first.update();
    }, { source, atEnd });
}

async function points(page: Page, selector: string, edge: 'start' | 'end', forward: boolean, atEnd: boolean) {
    return page.locator(editor.paragraphContent).first().evaluate((content, { selector, edge, forward, atEnd }) => {
        const element = content.querySelector(selector)!;
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = element.tagName === 'CODE' ? range.getBoundingClientRect() : element.getBoundingClientRect();
        const left = rect.left;
        const target = forward && atEnd
            ? document.querySelectorAll('.mu-paragraph-content')[1]
            : content;
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let node;
        while ((node = walker.nextNode()))
            nodes.push(node as Text);
        const text = forward && !atEnd ? nodes[nodes.length - 1] : nodes[0];
        range.setStart(text, forward && !atEnd ? text.length : 0);
        range.collapse(true);
        const destination = range.getBoundingClientRect();
        return {
            boundary: { x: edge === 'start' ? left : rect.right, y: rect.y + rect.height / 2 },
            outside: { x: destination.x, y: destination.y + destination.height / 2 },
        };
    }, { selector, edge, forward, atEnd });
}

for (const item of cases) {
    for (const endpoint of ['anchor', 'focus'] as const) {
        test(`${item.name}: collapsed ${endpoint} selects complete source (#3410)`, async ({ page }) => {
            for (const atEnd of [false, true]) {
                for (const edge of ['start', 'end'] as const) {
                    for (const forward of [false, true]) {
                        for (const dx of [-1, 1]) {
                            await setup(page, item.source, atEnd);
                            const { boundary, outside } = await points(page, item.selector, edge, forward, atEnd);
                            const inside = { x: boundary.x + dx, y: boundary.y };
                            const [start, end] = endpoint === 'anchor' ? [inside, outside] : [outside, inside];
                            await page.mouse.move(start.x, start.y);
                            await page.mouse.down();
                            await page.mouse.move(end.x, end.y, { steps: 5 });
                            await page.mouse.up();
                            const context = JSON.stringify({ name: item.name, endpoint, atEnd, edge, forward, dx });
                            await expect.poll(() => page.evaluate(endpoint => window.muya!.editor.selection.getTextSelection()?.[endpoint].offset, endpoint), {
                                message: context,
                            }).toBe(edge === 'start' ? 7 : 7 + item.source.length);
                            const expected = forward
                                ? (edge === 'start' ? item.source : '') + (atEnd ? '\n\n' : ' after')
                                : 'Before ' + (edge === 'end' ? item.source : '');
                            await expect.poll(() => page.evaluate(() => window.muya!.getSelectedText()), { message: context }).toBe(expected);
                        }
                    }
                }
            }
        });
    }
}

for (const item of cases.filter(item => ['link', 'strong'].includes(item.name))) {
    test(`${item.name}: delete and undo use the normalized source range`, async ({ page }) => {
        await setup(page, item.source, false);
        const { boundary, outside } = await points(page, item.selector, 'end', false, false);
        await page.mouse.move(boundary.x - 1, boundary.y);
        await page.mouse.down();
        await page.mouse.move(outside.x, outside.y, { steps: 5 });
        await page.mouse.up();
        await page.keyboard.press('Backspace');
        await expect.poll(() => page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.text)).toBe(' after');
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.text)).toBe(`Before ${item.source} after`);
    });
}

for (const marker of ['<br>', '<br/>', '<br />']) {
    for (const formatted of [false, true]) {
        for (const backward of [false, true]) {
            test(`selecting after ${marker} preserves the break (formatted: ${formatted}, backward: ${backward})`, async ({ page }) => {
                const before = formatted ? '**one**' : 'one';
                const after = formatted ? '**two**' : 'two';
                const source = before + marker + after;
                await page.evaluate((source) => {
                    window.muya!.setContent(source);
                    window.muya!.editor.scrollPage!.firstContentInDescendant()!.update();
                }, source);
                const { start, end } = await page.locator(editor.paragraphContent).first().evaluate((content) => {
                    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = walker.nextNode())) {
                        if (node.textContent === 'two')
                            break;
                    }
                    if (!node)
                        throw new Error('Missing text after the line break');
                    const range = document.createRange();
                    range.setStart(node, 0);
                    range.collapse(true);
                    const start = range.getBoundingClientRect();
                    range.setStart(node, 3);
                    const end = range.getBoundingClientRect();
                    return {
                        start: { x: start.x, y: start.y + start.height / 2 },
                        end: { x: end.x, y: end.y + end.height / 2 },
                    };
                });
                const [anchor, focus] = backward ? [end, start] : [start, end];
                await page.mouse.move(anchor.x, anchor.y);
                await page.mouse.down();
                await page.mouse.move(focus.x, focus.y, { steps: 5 });
                await page.mouse.up();
                await expect.poll(() => page.evaluate(() => window.muya!.getSelectedText())).toBe(after);
                await page.keyboard.press('Backspace');
                await expect.poll(() => page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.text)).toBe(before + marker);
                await page.evaluate(() => window.muya!.undo());
                await expect.poll(() => page.evaluate(() => window.muya!.editor.scrollPage!.firstContentInDescendant()!.text)).toBe(source);
            });
        }
    }
}
