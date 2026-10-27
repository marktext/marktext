import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

async function caret(page: Page, text: string, offset: number) {
    await page.evaluate(({ text, offset }) => {
        let block = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (block && block.text !== text)
            block = block.nextContentInContext() ?? null;
        if (!block)
            throw new Error(`Missing content ${text}`);
        block.setCursor(offset, offset, true);
    }, { text, offset });
}
test('real Tab input, deletion and undo use character offsets', async ({ page }) => {
    await page.evaluate(() => window.muya!.setOptions({ tabSize: 'tab' }));
    await loadMarkdown(page, 'hello\n');
    await caret(page, 'hello', 5);
    await page.keyboard.press('Tab');
    await expect.poll(() => getMarkdown(page)).toBe('hello\t\n');
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('hello\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('hello\t\n');
});

test('existing tabs use four-column stops regardless of the space input choice', async ({ page }) => {
    await page.evaluate(() => window.muya!.setOptions({ tabSize: 2 }));
    await loadMarkdown(page, '```text\na\tX\naaa\tX\n```\n');
    const positions = await page.locator('.mu-codeblock-content').evaluate((element) => {
        element.setAttribute('style', 'font-family: monospace; font-size: 16px;');
        const text = element.querySelector('.mu-syntax-text')?.firstChild ?? element.firstChild!;
        const range = document.createRange();
        const value = text.textContent!;
        const positions: number[] = [];
        for (let i = 0; i < value.length; i++) {
            if (value[i] !== 'X')
                continue;
            range.setStart(text, i);
            range.setEnd(text, i + 1);
            positions.push(range.getBoundingClientRect().left);
        }
        return { positions, tabSize: getComputedStyle(element).tabSize };
    });
    expect(positions.tabSize).toBe('4');
    expect(positions.positions).toHaveLength(2);
    expect(Math.abs(positions.positions[0] - positions.positions[1])).toBeLessThan(1);
});

test('tabs in table cells keep their navigation behavior', async ({ page }) => {
    await page.evaluate(() => window.muya!.setOptions({ tabSize: 'tab' }));
    await loadMarkdown(page, '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    await caret(page, '1', 1);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.block.text)).toBe('2');
    expect(await getMarkdown(page)).not.toContain('\t');
});
