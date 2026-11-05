import { expect, test } from '../fixtures/muya';

test('CJK compatibility stays aligned across live toggles, outline, export and copying', async ({ page }) => {
    const markdown = '# 中文**"标题"**中文\n\n**来源：**HTML\n\na**中文**b';
    await page.evaluate(source => window.muya!.setContent(source), markdown);
    expect(await page.evaluate(() => window.muya!.options.cjkEmphasis)).toBe(true);
    const original = await page.evaluate(() => window.muya!.getMarkdown());

    for (const cjkEmphasis of [true, false, true]) {
        await page.evaluate(value => window.muya!.setOptions({ cjkEmphasis: value }, true), cjkEmphasis);
        await expect(page.locator('.mu-editor strong')).toHaveCount(cjkEmphasis ? 3 : 1);

        const result = await page.evaluate(async () => {
            const muya = window.muya!;
            const first = muya.editor.scrollPage!.firstContentInDescendant()!;
            muya.setSelection({
                kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
                anchor: { path: first.path, offset: 0 },
                focus: { path: first.path, offset: first.text.length },
            });
            const copied = muya.editor.clipboard.getClipboardData();
            const html = await new window.MarkdownToHtml!(muya.getMarkdown(), muya).renderHtml();
            const exported = new DOMParser().parseFromString(html, 'text/html');
            const clipboard = new DOMParser().parseFromString(copied.html, 'text/html');
            return {
                markdown: muya.getMarkdown(),
                toc: muya.getTOC()[0].content,
                exportedHeading: exported.querySelector('h1')?.textContent,
                exportedStrong: exported.querySelectorAll('strong').length,
                copiedHeading: clipboard.body.textContent?.trim(),
                copiedStrong: clipboard.querySelectorAll('strong').length,
            };
        });

        const heading = cjkEmphasis ? '中文"标题"中文' : '中文**"标题"**中文';
        expect(result).toEqual({
            markdown: original,
            toc: heading,
            exportedHeading: heading,
            exportedStrong: cjkEmphasis ? 3 : 1,
            copiedHeading: heading,
            copiedStrong: cjkEmphasis ? 1 : 0,
        });
    }
});
