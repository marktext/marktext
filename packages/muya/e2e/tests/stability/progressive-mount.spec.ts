import { expect, test } from '../fixtures/muya';

test.describe('progressive mount consumers', () => {
    test('reads the complete document and mounts a TOC target before background work', async ({ page }) => {
        const result = await page.evaluate(() => {
            const muya = window.muya!;
            const parts = Array.from({ length: 700 }, (_, i) => `Paragraph ${i}`);
            parts[0] = '[link][tail]';
            parts[650] = '# Tail heading';
            parts[699] = '[tail]: https://example.com/target';
            muya.setContent(parts.join('\n\n'));
            const initial = muya.editor.scrollPage!.children.length;
            const toc = muya.getTOC();
            const markdown = muya.getMarkdown();
            const stateLength = muya.getState().length;
            const afterRead = muya.editor.scrollPage!.children.length;
            const href = muya.domNode.querySelector('a')?.getAttribute('href');
            const mounted = muya.ensureMountedThrough(toc[0].index);
            return {
                initial, afterRead, stateLength, markdown, href, mounted, toc,
                heading: muya.domNode.querySelector('h1')?.textContent,
                afterTarget: muya.editor.scrollPage!.children.length,
            };
        });
        expect(result.initial).toBeLessThan(650);
        expect(result.afterRead).toBe(result.initial);
        expect(result.stateLength).toBe(700);
        expect(result.markdown).toContain('[tail]: https://example.com/target');
        expect(result.href).toBe('https://example.com/target');
        expect(result.toc).toMatchObject([{ content: 'Tail heading', index: 650 }]);
        expect(result.mounted).toBe(true);
        expect(result.heading).toContain('Tail heading');
        expect(result.afterTarget).toBe(651);
    });

    test('restores a cursor into the pending tail and keeps subsequent typing', async ({ page }) => {
        const result = await page.evaluate(() => {
            const muya = window.muya!;
            muya.setContent(Array.from({ length: 700 }, (_, i) => `Paragraph ${i}`).join('\n\n'));
            const initial = muya.editor.scrollPage!.children.length;
            const restored = muya.setCursorByOffset({
                anchor: { line: 1300, ch: 13 },
                focus: { line: 1300, ch: 13 },
            });
            return { initial, restored, text: muya.editor.selection.getSelection()?.anchor.block.text };
        });
        expect(result.initial).toBeLessThan(650);
        expect(result.restored).toBe(true);
        expect(result.text).toBe('Paragraph 650');
        await page.keyboard.type('!');
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toContain('Paragraph 650!');
        await expect.poll(() => page.evaluate(() => window.muya!.editor.scrollPage!.children.length)).toBe(700);
    });

    test('search and select-all include the tail immediately after replacement', async ({ page }) => {
        const result = await page.evaluate(() => {
            const muya = window.muya!;
            const markdown = Array.from({ length: 700 }, (_, i) => `Paragraph ${i}`).join('\n\n');
            muya.setContent(markdown);
            const beforeSearch = muya.editor.scrollPage!.children.length;
            muya.search('Paragraph 699');
            const matches = muya.editor.searchModule.matches.map(match => match.block.text);
            muya.setContent(markdown);
            const beforeSelect = muya.editor.scrollPage!.children.length;
            muya.selectAll();
            return { beforeSearch, matches, beforeSelect, selected: document.getSelection()?.toString() };
        });
        expect(result.beforeSearch).toBeLessThan(700);
        expect(result.matches).toEqual(['Paragraph 699']);
        expect(result.beforeSelect).toBeLessThan(700);
        expect(result.selected).toContain('Paragraph 0');
        expect(result.selected).toContain('Paragraph 699');
    });
});
