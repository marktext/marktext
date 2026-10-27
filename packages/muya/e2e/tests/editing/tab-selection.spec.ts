import { expect, test } from '../fixtures/muya';
import { getMarkdown, getState } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

for (const tabSize of [4, 'tab'] as const) {
    test(`paragraph indentation becomes code immediately with ${tabSize} input and survives reloading`, async ({ page }) => {
        const markdown = 'one\n\n**two**\n';
        await loadMarkdown(page, markdown);
        await page.evaluate((tabSize) => {
            const muya = window.muya!;
            muya.setOptions({ tabSize });
            const first = muya.editor.scrollPage!.firstChild!.firstContentInDescendant()!;
            const last = muya.editor.scrollPage!.lastChild!.firstContentInDescendant()!;
            muya.editor.selection.setSelection({
                kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
                anchor: { path: last.path, offset: last.text.length },
                focus: { path: first.path, offset: 0 },
            });
        }, tabSize);
        await page.keyboard.press('Tab');
        const expected = [{ name: 'code-block', meta: { type: 'indented', lang: '' }, text: 'one\n\n**two**' }];
        await expect.poll(() => getState(page)).toEqual(expected);
        await expect(page.locator('.mu-indented-code')).toHaveCount(1);
        expect(await page.evaluate(() => {
            const selection = window.muya!.editor.selection.getTextSelection()!;
            return [selection.anchor.offset, selection.focus.offset];
        })).toEqual([12, 0]);
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe(markdown);
        await page.evaluate(() => window.muya!.redo());
        await expect.poll(() => getState(page)).toEqual(expected);
        await loadMarkdown(page, await getMarkdown(page));
        await expect.poll(() => getState(page)).toEqual(expected);
    });
}

test('selected code lines indent and outdent without running completion', async ({ page }) => {
    await loadMarkdown(page, '```text\none\ntwo\nthree\n```\n');
    await page.evaluate(() => {
        const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        window.muya!.editor.selection.setSelection({
            kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
            anchor: { path: block.path, offset: 8 },
            focus: { path: block.path, offset: 0 },
        });
    });
    await page.keyboard.press('Tab');
    await expect.poll(() => getMarkdown(page)).toBe('```text\n    one\n    two\nthree\n```\n');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => getMarkdown(page)).toBe('```text\none\ntwo\nthree\n```\n');
});

test('one physical Tab press moves a list selection only once', async ({ page }) => {
    await loadMarkdown(page, '- a\n- b\n- c\n- d\n');
    await page.evaluate(() => {
        const { scrollPage, selection } = window.muya!.editor;
        const list = scrollPage!.firstChild!;
        const start = list.find(1)!.firstContentInDescendant()!;
        const end = list.find(2)!.firstContentInDescendant()!;
        selection.setSelection({
            kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
            anchor: { path: start.path, offset: 0 },
            focus: { path: end.path, offset: 1 },
        });
    });
    await page.keyboard.press('Tab');
    await expect.poll(() => getMarkdown(page)).toBe('- a\n  - b\n  - c\n- d\n');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => getMarkdown(page)).toBe('- a\n- b\n- c\n- d\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('- a\n  - b\n  - c\n- d\n');
});

for (const { name, markdown, expected, startIndex } of [
    {
        name: 'bullet',
        markdown: '- a\n  - b\n  - c\n  - d\n',
        expected: '- a\n- b\n- c\n  - d\n',
        startIndex: 0,
    },
    {
        name: 'ordered',
        markdown: '- a\n  5. b\n  6. c\n  7. d\n',
        expected: '- a\n- b\n- c\n  7. d\n',
        startIndex: 0,
    },
    {
        name: 'ordered task',
        markdown: '- a\n  5. [ ] b\n  6. [x] c\n  7. [ ] d\n',
        expected: '- a\n  5. [ ] b\n6. [x] c\n   7. [ ] d\n',
        startIndex: 1,
    },
]) {
    test(`outdenting ${name} items through the start of an excluded tail preserves numbering and selection`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await loadMarkdown(page, markdown);
        await page.evaluate((startIndex) => {
            const { scrollPage, selection } = window.muya!.editor;
            const nested = scrollPage!.firstChild!.firstChild!.lastChild!;
            const b = nested.find(startIndex)!.firstContentInDescendant()!;
            const d = nested.find(2)!.firstContentInDescendant()!;
            selection.setSelection({
                kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
                anchor: { path: b.path, offset: 0 },
                focus: { path: d.path, offset: 0 },
            });
        }, startIndex);
        await page.keyboard.press('Shift+Tab');
        await expect.poll(() => getMarkdown(page)).toBe(expected);
        const focus = await page.evaluate(() => {
            const focus = window.muya!.editor.selection.getTextSelection()!.focus;
            return { text: focus.block.text, offset: focus.offset };
        });
        expect(focus).toEqual({ text: 'd', offset: 0 });
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe(markdown);
        expect(errors).toEqual([]);
    });

}
