import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';

test.describe('fancy-list clipboard fidelity', () => {
    test('rich copy, paste, undo, redo and reopen preserve source markers', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'Requires Chromium clipboard permissions.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        for (const markdown of [
            'I.  outer\n    A.  inner\nII. next\n',
            '#. first\n#. second\n',
            '(a) [ ] first\n(b) [x] second\n',
        ]) {
            await page.evaluate((markdown) => {
                window.__e2e!.rebuildMuya({ markdown, fancyLists: true });
                const muya = window.muya!;
                muya.domNode.focus();
                const first = muya.editor.scrollPage!.firstContentInDescendant()!;
                const last = muya.editor.scrollPage!.lastContentInDescendant()!;
                first.setCursor(0, 0, true);
                const selection = document.getSelection()!;
                const firstNode = selection.anchorNode!;
                const firstOffset = selection.anchorOffset;
                last.setCursor(last.text.length, last.text.length, true);
                selection.setBaseAndExtent(firstNode, firstOffset, selection.focusNode!, selection.focusOffset);
            }, markdown);
            await page.evaluate(() => window.muya!.copyAsRich());
            expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(markdown);
            await page.evaluate(() => {
                const muya = window.muya!;
                muya.setContent('');
                muya.domNode.focus();
                muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
            });
            await page.keyboard.press(`${metaKey()}+v`);
            await expect.poll(() => getMarkdown(page)).toBe(markdown);
            await page.evaluate(() => window.muya!.undo());
            await expect.poll(() => getMarkdown(page)).toBe('\n');
            await page.evaluate(() => window.muya!.redo());
            await expect.poll(() => getMarkdown(page)).toBe(markdown);
            await page.evaluate(() => {
                const markdown = window.muya!.getMarkdown();
                window.__e2e!.rebuildMuya({ markdown, fancyLists: true });
            });
            expect(await getMarkdown(page)).toBe(markdown);
        }
    });

    test('pasting another ordered style keeps both lists', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'Requires Chromium clipboard permissions.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.evaluate(async () => {
            window.__e2e!.rebuildMuya({ markdown: 'a. existing\n', fancyLists: true });
            const muya = window.muya!;
            muya.domNode.focus();
            const block = muya.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(block.text.length, block.text.length, true);
            await navigator.clipboard.writeText('i. pasted\nii. next\n');
        });
        await page.keyboard.press(`${metaKey()}+v`);
        await expect.poll(() => getMarkdown(page)).toContain('i. pasted');
        const markdown = await getMarkdown(page);
        expect(markdown).toContain('a. existing');
        expect(markdown).not.toContain('existingpasted');
    });

    test('independent nested lists keep spacing through paste, history and reopen', async ({ browserName, context, page }) => {
        test.skip(browserName !== 'chromium', 'Requires Chromium clipboard permissions.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        const source = '- parent\n  a. existing\n';
        await page.evaluate(async (markdown) => {
            window.__e2e!.rebuildMuya({ markdown, fancyLists: true });
            const muya = window.muya!;
            muya.domNode.focus();
            const block = muya.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(block.text.length, block.text.length, true);
            await navigator.clipboard.writeText('a. pasted\n');
        }, source);
        await page.keyboard.press(`${metaKey()}+v`);
        await expect.poll(() => getMarkdown(page)).toContain('<!-- -->');
        const saved = await getMarkdown(page);
        expect(saved).toContain('- parent\n\n');
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe(source);
        await page.evaluate(() => window.muya!.redo());
        await expect.poll(() => getMarkdown(page)).toBe(saved);
        await page.evaluate((markdown) => window.muya!.setContent(markdown), saved);
        expect(await getMarkdown(page)).toBe(saved);
    });
});
