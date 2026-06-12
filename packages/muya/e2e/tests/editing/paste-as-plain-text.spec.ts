import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';

/**
 * Regression: "Paste as Plain Text" must insert the clipboard's plain text
 * without converting rich HTML to markdown.
 *
 * The bug: `pasteAsPlainText()` relied on `document.execCommand('paste')`,
 * which Chromium turned into a no-op (returns false, fires no paste event),
 * so nothing pasted at all. The fix reads the clipboard text via the async
 * Clipboard API (here the `navigator.clipboard.readText()` fallback, since the
 * e2e host wires no `clipboardText` hook) and routes it through the pipeline
 * with the plain-text flag.
 */
test.describe('pasteAsPlainText', () => {
    test('inserts plain text, ignoring clipboard HTML formatting', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem/readText unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await page.evaluate(() => window.muya!.setContent(''));

        // Rich HTML + matching plain text on the clipboard. A normal paste would
        // emit **foo** / a markdown link; paste-as-plain-text must not.
        await page.evaluate(async () => {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob(
                        ['<b>foo</b> and <a href="https://example.test/">bar</a>'],
                        { type: 'text/html' },
                    ),
                    'text/plain': new Blob(['foo and bar'], { type: 'text/plain' }),
                }),
            ]);
        });

        await page.evaluate(async () => {
            window.muya!.focus();
            window.muya!.domNode.focus();
            await window.muya!.pasteAsPlainText();
        });

        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('foo and bar');

        const md = await getMarkdown(page);
        // No bold markers and no markdown link syntax — proves the HTML was
        // ignored and the raw plain text was inserted.
        expect(md).not.toMatch(/\*\*/);
        expect(md).not.toMatch(/\]\(/);
    });
});
