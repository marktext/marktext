import { devices } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown, getState } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// Desktop Chrome's descriptor uses a Windows UA even on a macOS test host.
test('list body Tab inserts text while fixed shortcuts and item-start Tab move the item', async ({ page }) => {
    await loadMarkdown(page, '- alpha\n- bravo\n');
    await page.evaluate(() => {
        window.muya!.setOptions({ tabSize: 'tab' });
        const block = window.muya!.editor.scrollPage!.firstChild!.find(1)!.firstContentInDescendant()!;
        block.setCursor(2, 2, true);
    });
    await page.keyboard.press('Tab');
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n- br\tavo\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n- bravo\n');
    await page.keyboard.press('Control+]');
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n  - bravo\n');
    await page.keyboard.press('Control+[');
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n- bravo\n');
    expect(await page.evaluate(() => window.muya!.editor.selection.getTextSelection()!.anchor.offset)).toBe(2);
    await page.evaluate(() => window.muya!.editor.selection.getTextSelection()!.anchor.block.setCursor(0, 0, true));
    await page.keyboard.press('Tab');
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n  - bravo\n');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => getMarkdown(page)).toBe('- alpha\n- bravo\n');
});

test('fixed shortcuts indent a code line without replacing its selection or expanding HTML', async ({ page }) => {
    await loadMarkdown(page, '```html\ndiv\nspan\n```\n');
    await page.evaluate(() => {
        window.muya!.setOptions({ tabSize: 4 });
        window.muya!.editor.scrollPage!.lastContentInDescendant()!.setCursor(3, 1, true);
    });
    await page.keyboard.press('Control+]');
    await expect.poll(() => getMarkdown(page)).toBe('```html\n    div\nspan\n```\n');
    expect(await page.evaluate(() => {
        const selection = window.muya!.editor.selection.getTextSelection()!;
        return [selection.anchor.offset, selection.focus.offset];
    })).toEqual([7, 5]);
    await page.keyboard.press('Control+[');
    await expect.poll(() => getMarkdown(page)).toBe('```html\ndiv\nspan\n```\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('```html\n    div\nspan\n```\n');
});

test('fixed paragraph indentation converts at four columns and has separate undo steps', async ({ page }) => {
    await loadMarkdown(page, 'hello\n');
    await page.evaluate(() => {
        window.muya!.setOptions({ tabSize: 2 });
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 2, true);
    });
    await page.keyboard.press('Control+]');
    await expect.poll(() => getMarkdown(page)).toBe('  hello\n');
    await page.keyboard.press('Control+]');
    await expect.poll(() => getState(page)).toEqual([{
        name: 'code-block', meta: { type: 'indented', lang: '' }, text: 'hello',
    }]);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('  hello\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('hello\n');
});

test('a backward list selection can be indented and outdented repeatedly with its excluded endpoint', async ({ page }) => {
    await loadMarkdown(page, '- a\n- b\n- c\n- d\n');
    await page.evaluate(() => {
        const { scrollPage, selection } = window.muya!.editor;
        const list = scrollPage!.firstChild!;
        const b = list.find(1)!.firstContentInDescendant()!;
        const d = list.find(3)!.firstContentInDescendant()!;
        selection.setSelection({
            kind: 'text' as import('@muyajs/core').SelectionType.TEXT,
            anchor: { path: d.path, offset: 0 },
            focus: { path: b.path, offset: 0 },
        });
    });
    await page.keyboard.press('Control+]');
    await expect.poll(() => getMarkdown(page)).toBe('- a\n  - b\n  - c\n- d\n');
    await page.keyboard.press('Control+[');
    await expect.poll(() => getMarkdown(page)).toBe('- a\n- b\n- c\n- d\n');
    const endpoints = await page.evaluate(() => {
        const selection = window.muya!.editor.selection.getTextSelection()!;
        return [selection.anchor.block.text, selection.anchor.offset, selection.focus.block.text, selection.focus.offset];
    });
    expect(endpoints).toEqual(['d', 0, 'b', 0]);
});

test.describe('macOS fixed shortcuts', () => {
    test.use({
        userAgent: devices['Desktop Chrome'].userAgent.replace(/\([^)]*\)/, '(Macintosh; Intel Mac OS X 10_15_7)'),
    });

    test('uses Command brackets for indentation', async ({ page }) => {
        await loadMarkdown(page, '- alpha\n- bravo\n');
        await page.evaluate(() => {
            window.muya!.editor.scrollPage!.lastContentInDescendant()!.setCursor(2, 2, true);
        });
        await page.keyboard.press('Meta+]');
        await expect.poll(() => getMarkdown(page)).toBe('- alpha\n  - bravo\n');
        await page.keyboard.press('Meta+[');
        await expect.poll(() => getMarkdown(page)).toBe('- alpha\n- bravo\n');
    });
});
