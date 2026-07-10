import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

/**
 * Real-HTML clipboard paste, driven via `navigator.clipboard.write()`
 * with `ClipboardItem` + a real OS-level paste keystroke. This is the
 * only approach that works on bundled Chromium-for-Testing (which CI
 * uses): synthetic `new ClipboardEvent('paste', { clipboardData: dt })`
 * leaves `event.clipboardData === null` on CfT (and Chrome's spec-
 * compliant path), so pasteHandler bails early. The earlier
 * `dispatchEvent` approach passed locally (where Playwright was set
 * to use the system Chrome stable channel — lenient about synthetic
 * ClipboardEvent) but failed on CI.
 *
 * The grantPermissions + clipboard.write + keyboard paste path is
 * spec-compliant and exercises the same code path real users hit.
 *
 * Firefox + WebKit are skipped per-test:
 *   - Firefox: `ClipboardItem` is gated behind a pref, and
 *     `clipboard.write({'text/html': ...})` is not universally
 *     available in headless.
 *   - WebKit: clipboard-read/write permissions can't be granted in
 *     Playwright's headless WebKit yet (Playwright issue #13037).
 *
 * Both engines tracked in BACKLOG Phase 3 (cross-engine clipboard).
 */

test.describe('clipboard paste', () => {
    test('clipboard module is wired (sanity-check via internal handle)', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        const wired = await page.evaluate(() => !!window.muya!.editor.clipboard);
        expect(wired).toBe(true);
        await expect(page.locator(editor.container)).toBeVisible();
    });

    test('pasting <b>foo</b> converts to **foo**', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        await pasteClipboard(page, '<b>foo</b>', 'foo');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/\*\*foo\*\*/);
    });

    test('pasting Google Docs CSS formatting preserves the real bold and italic ranges', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const html = [
            '<b style="font-weight:normal" id="docs-internal-guid-abc">',
            '<p dir="ltr">',
            '<span style="font-weight:700">Bold</span>',
            '<span> normal </span>',
            '<span style="font-style:italic">italic</span>',
            '</p>',
            '</b>',
        ].join('');

        await pasteClipboard(page, html, 'Bold normal italic');

        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('**Bold** normal *italic*\n');

        const md = await getMarkdown(page);
        expect(md).not.toContain('**\n\n');
    });

    test('pasting <a href> converts to markdown link', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        await pasteClipboard(page, '<a href="https://example.test/">click here</a>', 'click here');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/\[click here\]\(https:\/\/example\.test\/?\)/);
    });

    test('pasting bare URL HTML link inside text preserves link markup', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const url = 'http://10.255.255.1/page';

        await page.evaluate(() => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
            window.muya!.setContent('AB');
            const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(1, 1, true);
        });

        await pasteClipboard(page, `<a href="${url}">${url}</a>`, url, { resetContent: false });
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe(`A[${url}](${url})B\n`);
    });

    test('pasting bare URL HTML link with auto-link boundaries keeps plain URL fallback', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const url = 'http://10.255.255.1/page';

        await page.evaluate(() => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
            window.muya!.setContent('A  B');
            const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(2, 2, true);
        });

        await pasteClipboard(page, `<a href="${url}">${url}</a>`, url, { resetContent: false });
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe(`A ${url} B\n`);
    });

    test('pasting bare URL HTML link before trailing punctuation keeps plain URL fallback', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const url = 'http://10.255.255.1/page';

        await page.evaluate(() => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
            window.muya!.setContent('A .');
            const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(2, 2, true);
        });

        await pasteClipboard(page, `<a href="${url}">${url}</a>`, url, { resetContent: false });
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe(`A ${url}.\n`);
    });

    test('pasting a basic <table> converts to a GFM table', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const html = '<table><thead><tr><th>h1</th><th>h2</th></tr></thead>'
            + '<tbody><tr><td>r1c1</td><td>r1c2</td></tr></tbody></table>';
        await pasteClipboard(page, html, 'h1\th2\nr1c1\tr1c2');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/\|\s*h1\s*\|\s*h2\s*\|/);

        const md = await getMarkdown(page);
        expect(md).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
        expect(md).toMatch(/\|\s*r1c1\s*\|\s*r1c2\s*\|/);
    });

    test('pasting nested HTML lists under ordered parents preserves nesting', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);

        await pasteClipboard(page, '<ol><li>one<ul><li>two</li></ul></li><li>three</li></ol>', 'one\ntwo\nthree');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('1. one\n   - two\n2. three');

        await pasteClipboard(page, '<ol><li>one<ol><li>two</li></ol></li><li>three</li></ol>', 'one\ntwo\nthree');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('1. one\n   1. two\n2. three');
    });

    test('pasting HTML task-list items creates task-list Markdown', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);

        await pasteClipboard(
            page,
            '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" disabled=""><span>&nbsp;</span>task</li></ul>',
            ' task',
        );
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('- [ ] task');
        await expect.poll(async () => page.evaluate(() => window.muya!.getState()[0].name), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('task-list');

        await pasteClipboard(
            page,
            '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked="" disabled=""><span>&nbsp;</span>done</li></ul>',
            ' done',
        );
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('- [x] done');
        await expect.poll(async () => page.evaluate(() => window.muya!.getState()[0].name), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('task-list');
    });

    test('pasting a <table> with first-row colspan converts to a GFM table', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        const html = '<table><tr><td colspan="2">A</td></tr><tr><td>B</td><td>C</td></tr></table>';
        await pasteClipboard(page, html, 'A\nB\tC');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toMatch(/\|\s*A\s*\|\s*\|/);

        const md = await getMarkdown(page);
        expect(md).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
        expect(md).toMatch(/\|\s*B\s*\|\s*C\s*\|/);
    });

    test('pasting plain text without HTML falls back to text insertion', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        await pastePlainClipboard(page, 'just plain text');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toContain('just plain text');

        const md = await getMarkdown(page);
        expect(md).not.toMatch(/[*_`|[\]]/);
    });

    test('pasting inline spaces with HTML still inserts the plain spaces', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'ClipboardItem text/html unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
        await grantClipboardPermissions(context);
        await pasteClipboardAt(page, 'AB', 1, '<span style="white-space: pre;">  </span>', '  ');
        await expect.poll(async () => getMarkdown(page), {
            timeout: 5_000,
            intervals: [50, 100, 250, 500],
        }).toBe('A  B\n');
    });
});

/**
 * Grant clipboard read/write to the current BrowserContext.
 *
 * Why per-test instead of `test.use({ permissions: [...] })` at describe
 * level: WebKit doesn't recognise the `'clipboard-write'` permission name
 * and `browserContext.newPage` throws with `Unknown permission:
 * clipboard-write` before any `test.skip(browserName !== 'chromium')`
 * inside the test body runs. By calling `grantPermissions` *after* the
 * skip check, the call is reached only on chromium where it works.
 */
async function grantClipboardPermissions(
    context: Parameters<Parameters<typeof test>[1]>[0]['context'],
): Promise<void> {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
}

/**
 * Write HTML+text to the real OS clipboard, focus the editor, fire a
 * real paste keystroke. The keystroke dispatches a trusted `paste`
 * event whose `clipboardData` is populated (unlike a synthetic
 * `new ClipboardEvent('paste', { clipboardData })`, which leaves
 * `clipboardData === null` on Chromium-for-Testing).
 */
async function pasteClipboard(
    page: Parameters<Parameters<typeof test>[1]>[0]['page'],
    html: string,
    text: string,
    options: { resetContent?: boolean } = {},
): Promise<void> {
    if (options.resetContent !== false)
        await page.evaluate(() => window.muya!.setContent(''));

    await page.evaluate(async ({ html, text }) => {
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
        ]);
    }, { html, text });

    // Focus via muya's API + DOM focus, so the trusted paste keystroke
    // lands inside the editor's contenteditable.
    await page.evaluate(() => {
        window.muya!.focus();
        window.muya!.domNode.focus();
    });
    await page.keyboard.press(`${metaKey()}+v`);
}

async function pasteClipboardAt(
    page: Parameters<Parameters<typeof test>[1]>[0]['page'],
    initial: string,
    offset: number,
    html: string,
    text: string,
): Promise<void> {
    await page.evaluate((value) => window.muya!.setContent(value), initial);

    await page.evaluate(async ({ html, text, offset }) => {
        const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(offset, offset, true);
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
        ]);
    }, { html, text, offset });

    await page.evaluate(() => {
        window.muya!.focus();
        window.muya!.domNode.focus();
    });
    await page.keyboard.press(`${metaKey()}+v`);
}

/**
 * Same as pasteClipboard but writes only `text/plain`.
 */
async function pastePlainClipboard(
    page: Parameters<Parameters<typeof test>[1]>[0]['page'],
    text: string,
): Promise<void> {
    await page.evaluate(() => window.muya!.setContent(''));

    await page.evaluate(async (text) => {
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
        ]);
    }, text);

    await page.evaluate(() => {
        window.muya!.focus();
        window.muya!.domNode.focus();
    });
    await page.keyboard.press(`${metaKey()}+v`);
}
