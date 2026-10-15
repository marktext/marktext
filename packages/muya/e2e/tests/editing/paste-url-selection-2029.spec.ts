import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';

test.describe('paste URL over selected text (#2029)', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ browserName, context }) => {
        test.skip(browserName !== 'chromium', 'Native clipboard permissions require Chromium.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });

    for (const rich of [false, true]) {
        test(`native ${rich ? 'HTML' : 'plain'} URL paste preserves the label and supports undo/redo`, async ({ page }) => {
            await page.evaluate(() => window.muya!.setContent('foo bar foo'));
            await expect.poll(() => getMarkdown(page)).toBe('foo bar foo\n');
            await page.evaluate(async (rich) => {
                const muya = window.muya!;
                muya.focus();
                muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(rich ? 7 : 4, rich ? 4 : 7, true);
                if (rich) {
                    await navigator.clipboard.write([new ClipboardItem({
                        'text/plain': new Blob(['https://home.com'], { type: 'text/plain' }),
                        'text/html': new Blob(['<a href="https://home.com">Page title</a>'], { type: 'text/html' }),
                    })]);
                }
                else {
                    await navigator.clipboard.writeText('https://home.com');
                }
            }, rich);
            await page.keyboard.press('ControlOrMeta+v');
            await expect.poll(() => getMarkdown(page)).toBe('foo [bar](https://home.com) foo\n');
            const cursor = await page.evaluate(() => {
                const selection = window.muya!.editor.selection.getSelection()!;
                return [selection.anchor.offset, selection.focus.offset];
            });
            expect(cursor).toEqual([27, 27]);
            await page.evaluate(() => window.muya!.undo());
            await expect.poll(() => getMarkdown(page)).toBe('foo bar foo\n');
            expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('bar');
            await page.evaluate(() => window.muya!.redo());
            await expect.poll(() => getMarkdown(page)).toBe('foo [bar](https://home.com) foo\n');
        });
    }

    test('plain-text paste replaces selected text', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('foo bar foo'));
        await expect.poll(() => getMarkdown(page)).toBe('foo bar foo\n');
        await page.evaluate(async () => {
            const muya = window.muya!;
            muya.focus();
            muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 7, true);
            await navigator.clipboard.writeText('https://home.com');
            await muya.pasteAsPlainText();
        });
        await expect.poll(() => getMarkdown(page)).toBe('foo https://home.com foo\n');
    });
});
