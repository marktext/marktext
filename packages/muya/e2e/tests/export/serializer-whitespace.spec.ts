import { expect, test } from '../fixtures/muya';

/**
 * Real-browser coverage for the export soft-break markup (follow-up to
 * #4844): the export render marks markdown-GENERATED paragraphs and list
 * items with `data-md` — the stylesheet scopes its pre-wrap to the marker —
 * and joins a tight item's direct children without marked's serializer
 * newlines, so nothing renders as a phantom row while authored whitespace,
 * including inline flow directly inside RAW HTML blockquotes, survives. The
 * unit suite pins the emitted markup; this spec pins the sanitize pass and
 * the rendered layout, which happy-dom cannot reproduce (it unwraps
 * top-level blocks during sanitize).
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

test('a heading list item renders without a phantom row in the exported document', async ({ page }) => {
    const html = await page.evaluate(async () => {
        const instance = new window.MarkdownToHtml!('- # heading\n');
        return instance.generate();
    });

    // Render the REAL export document (inlined export stylesheet included)
    // and measure: the item must hug its heading instead of carrying an
    // extra ~half-line from marked's `</h1>\n</li>` newline.
    await page.setContent(html);
    const { li, h1 } = await page.evaluate(() => ({
        li: document.querySelector('.markdown-body li')!.getBoundingClientRect().height,
        h1: document.querySelector('.markdown-body h1')!.getBoundingClientRect().height,
    }));

    expect(li).toBeLessThan(h1 * 1.5);
});
