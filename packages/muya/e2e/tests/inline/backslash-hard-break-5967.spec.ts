import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

for (const softNewlineAsSpace of [false, true]) {
    for (const [name, source] of [
        ['backslash', 'foo\\\n     baz'],
        ['spaces after tab', 'foo\t  \n     baz'],
    ]) {
        test(`${name} hard breaks keep two aligned lines (softNewlineAsSpace: ${softNewlineAsSpace})`, async ({ page }) => {
            await page.evaluate(({ source, softNewlineAsSpace }) => {
                window.muya!.setOptions({ softNewlineAsSpace });
                window.muya!.setContent(source);
            }, { source, softNewlineAsSpace });
            await expect(page.locator(editor.hardLineBreak)).toHaveCount(1);
            const geometry = await page.locator(editor.paragraphContent).evaluate((element) => {
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                const rects: DOMRect[] = [];
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    if (node.textContent === 'foo' || node.textContent === 'baz') {
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        rects.push(range.getBoundingClientRect());
                    }
                }
                return {
                    x: rects.map(rect => rect.x),
                    y: rects.map(rect => rect.y),
                    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
                    height: element.getBoundingClientRect().height,
                    text: element.textContent,
                };
            });
            expect(geometry.x).toHaveLength(2);
            expect(geometry.x[1]).toBeCloseTo(geometry.x[0], 0);
            expect(geometry.y[1] - geometry.y[0]).toBeCloseTo(geometry.lineHeight, 0);
            expect(geometry.height).toBeCloseTo(geometry.lineHeight * 2, 0);
            expect(geometry.text).toBe(source);
            expect(await getMarkdown(page)).toBe(`${source}\n`);
            await page.evaluate(() => {
                const saved = window.muya!.getMarkdown();
                window.muya!.setContent(saved);
                window.muya!.setReadOnly(true);
            });
            await expect(page.locator(editor.hardLineBreak)).toHaveCount(1);
            await expect(page.locator(editor.paragraphContent)).toHaveText(source);
        });
    }
}

test('recognizes hard breaks in emphasis, links, lists and quotes', async ({ page }) => {
    const source = '*foo\\\nbar*\n\n[foo\\\nbar](/url)\n\n- foo\\\n  bar\n\n> foo\\\n> bar';
    await page.evaluate(source => window.muya!.setContent(source), source);
    await expect(page.locator(editor.hardLineBreak)).toHaveCount(4);
    expect(await getMarkdown(page)).toBe(`${source}\n`);
});

test('deleting the marker and undoing preserves the newline and caret offsets', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('foo\\\nbar');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
    });
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('foo\nbar\n');
    await expect(page.locator(editor.hardLineBreak)).toHaveCount(0);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('foo\\\nbar\n');
    await expect(page.locator(editor.hardLineBreak)).toHaveCount(1);
    const offset = await page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.offset);
    expect(offset).toBe(4);
    await page.evaluate(() => window.muya!.redo());
    await expect.poll(() => getMarkdown(page)).toBe('foo\nbar\n');
});

test('arrow navigation shows and hides the backslash without changing the document', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('foo\\\nbar');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 2, true);
    });
    const marker = page.locator(editor.hardLineBreakSpace).locator('span');
    await expect(marker).toHaveClass(/mu-hide/);
    await page.keyboard.press('ArrowRight');
    await expect(marker).toHaveClass(/mu-gray/);
    await page.keyboard.press('ArrowLeft');
    await expect(marker).toHaveClass(/mu-hide/);
    expect(await getMarkdown(page)).toBe('foo\\\nbar\n');
});

test('clicking between paragraphs updates backslash visibility', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('foo\\\nbar\n\nA much longer paragraph with the caret well beyond the hard break range.');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
    });
    const marker = page.locator(editor.hardLineBreakSpace).locator('span');
    await expect(marker).toHaveClass(/mu-gray/);
    await page.locator(editor.paragraphContent).nth(1).click();
    await expect(marker).toHaveClass(/mu-hide/);
    const target = await page.locator(editor.paragraphContent).first().evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element.firstChild!);
        const rect = range.getBoundingClientRect();
        return { x: rect.right - 1, y: rect.y + rect.height / 2 };
    });
    await page.mouse.click(target.x, target.y);
    await expect(marker).toHaveClass(/mu-gray/);
});

test('typing after a trailing backslash and Shift+Enter retains the hard break', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('foo\\');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
    });
    await page.keyboard.press('Shift+Enter');
    await expect(page.locator(editor.hardLineBreak)).toHaveCount(1);
    await page.keyboard.type('bar');
    await expect.poll(() => getMarkdown(page)).toBe('foo\\\nbar\n');
});

test('arrow keys cross a hard break even when soft breaks render as spaces', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setOptions({ softNewlineAsSpace: true });
        window.muya!.setContent('foo\\\nbar');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
    });
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.offset)).toBe(5);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.getTextSelection()?.anchor.offset)).toBe(0);
});

test('a hidden backslash marker adds no extra lines near the right margin', async ({ page }) => {
    await page.evaluate(() => {
        const text = 'AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH';
        window.muya!.setContent(`${text}\\\nsecond\n\n${text}\nsecond`);
    });
    const mismatches = await page.evaluate((selectors) => {
        const root = document.querySelector<HTMLElement>(selectors.container)!;
        const [hard, soft] = [...document.querySelectorAll<HTMLElement>(selectors.paragraphContent)];
        const mismatches: number[] = [];
        for (let width = 360; width <= 760; width++) {
            root.style.width = `${width}px`;
            if (Math.abs(hard.getBoundingClientRect().height - soft.getBoundingClientRect().height) > 1)
                mismatches.push(width);
        }
        root.style.width = '';
        return mismatches;
    }, editor);
    expect(mismatches).toEqual([]);
});

test('pasting CRLF markdown preserves backslash hard breaks', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native clipboard permissions require Chromium.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async () => {
        window.muya!.setContent('');
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        await navigator.clipboard.writeText('foo\\\r\nbar');
    });
    await page.keyboard.press(`${metaKey()}+v`);
    await expect(page.locator(editor.hardLineBreak)).toHaveCount(1);
    await expect.poll(() => getMarkdown(page)).toBe('foo\\\nbar\n');
});
