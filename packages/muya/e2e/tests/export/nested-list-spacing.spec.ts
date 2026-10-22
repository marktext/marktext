import { expect, test } from '../fixtures/muya';

// #5767 — a tight nested list exported to HTML/PDF showed a blank line after
// every nested item, while the top-level items stayed tight. The export renders
// soft line breaks with `white-space: pre-wrap` (#3676); that must not expose
// the newlines marked pretty-prints between list tags. A list without soft
// breaks has to lay out exactly as it does under the default `normal`.

const markdown = `- one
- two
    - three
    - four
        - five
        - six
    - seven
- eight

1. one
2. two
    1. three
    2. four
3. five

- [ ] one
    - [x] two
    - [ ] three
- [ ] four
`;

test('tight nested lists export without blank lines between items (#5767)', async ({ page, browser }) => {
    const html = await page.evaluate(async md => new window.MarkdownToHtml!(md).generate(), markdown);

    const context = await browser.newContext({ offline: true });
    try {
        const exported = await context.newPage();
        await exported.setContent(html);

        const itemTops = () => exported.evaluate(() =>
            [...document.querySelectorAll('.markdown-body li')].map(li => Math.round(li.getBoundingClientRect().top)),
        );

        const actual = await itemTops();
        await exported.addStyleTag({ content: '.markdown-body * { white-space: normal !important; }' });
        const expected = await itemTops();

        expect(actual).toEqual(expected);
    }
    finally {
        await context.close();
    }
});

test('raw HTML lists retain authored spaces in exports', async ({ page, browser }) => {
    const markdown = '<ul><li><span>A</span><ul style="display:inline"><li style="display:inline">B</li></ul> <span>C</span></li></ul>';
    const html = await page.evaluate(async md => new window.MarkdownToHtml!(md).generate(), markdown);
    const context = await browser.newContext({ offline: true });
    try {
        const exported = await context.newPage();
        await exported.setContent(html);
        expect(await exported.locator('.markdown-body').innerText()).toBe('AB C');
    }
    finally {
        await context.close();
    }
});
