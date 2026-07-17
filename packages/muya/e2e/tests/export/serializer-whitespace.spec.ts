import { expect, test } from '../fixtures/muya';

/**
 * Real-browser coverage for the export soft-break rendering (follow-up to
 * #4844): authored soft breaks render as `<br>` at the inline text leaf
 * (`exportSoftBreaks`), everything else stays byte-for-byte
 * marked-canonical, and no stylesheet whitespace rules exist to interfere
 * with raw HTML or user export themes. The unit suite pins the emitted
 * markup; this spec pins the sanitize pass and the rendered layout in a
 * real Chromium (happy-dom unwraps top-level blocks during sanitize).
 */

test('raw-blockquote inline whitespace survives the real sanitize pass', async ({ page }) => {
    const html = await page.evaluate(async () => {
        const instance = new window.MarkdownToHtml!(
            '<blockquote><strong>left</strong> <strong>right</strong></blockquote>\n',
        );
        return instance.renderHtml();
    });

    // The blockquote survives DOMPurify in a real browser, and the authored
    // space between the inline siblings is intact — not "leftright".
    expect(html).toContain(
        '<blockquote><strong>left</strong> <strong>right</strong></blockquote>',
    );
});

test('a soft break renders as a real second line in the exported document', async ({ page }) => {
    const single = await page.evaluate(async () => {
        const instance = new window.MarkdownToHtml!('line one\n');
        return instance.generate();
    });
    const soft = await page.evaluate(async () => {
        const instance = new window.MarkdownToHtml!('line one\nline two\n');
        return instance.generate();
    });

    await page.setContent(single);
    const singleHeight = await page.evaluate(
        () => document.querySelector('.markdown-body p')!.getBoundingClientRect().height,
    );
    await page.setContent(soft);
    const softHeight = await page.evaluate(
        () => document.querySelector('.markdown-body p')!.getBoundingClientRect().height,
    );

    expect(softHeight).toBeGreaterThan(singleHeight * 1.8);
    expect(softHeight).toBeLessThan(singleHeight * 2.6);
});

test('a tight item with a nested list renders without phantom rows', async ({ page }) => {
    // `- line A\n  - child` is exactly two text lines. marked's canonical
    // serializer newlines around the nested list collapse under normal
    // whitespace — if any stylesheet rule ever re-interprets them again
    // (the withdrawn pre-wrap approach measured 105px here instead of
    // ~2 lines), this catches it.
    const measure = async (markdown: string, selector: string) => {
        const html = await page.evaluate(async (md) => {
            const instance = new window.MarkdownToHtml!(md);
            return instance.generate();
        }, markdown);
        await page.setContent(html);
        return page.evaluate(
            sel => document.querySelector(sel)!.getBoundingClientRect().height,
            selector,
        );
    };

    const single = await measure('- line A\n', '.markdown-body > ul > li');
    const nested = await measure('- line A\n  - child\n', '.markdown-body > ul > li');

    expect(nested).toBeGreaterThan(single * 1.6);
    expect(nested).toBeLessThan(single * 2.6);
});
