import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';

async function points(page: Page, sourceIndex = 0, targetIndex = 1, start = 1, end = 3) {
    return page.evaluate(({ sourceIndex, targetIndex, start, end }) => {
        const muya = window.muya!;
        const contents = [...muya.domNode.querySelectorAll<HTMLElement>('.mu-content')]
            .filter(node => !node.classList.contains('mu-language-input'));
        const source = contents[sourceIndex];
        const target = contents[targetIndex];
        const selection = document.getSelection()!;
        const range = document.createRange();
        const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode()!;
        let remaining = start;
        while (remaining > node.textContent!.length) {
            remaining -= node.textContent!.length;
            node = walker.nextNode()!;
        }
        range.setStart(node, remaining);
        let rest = end - start + remaining;
        while (rest > node.textContent!.length) {
            rest -= node.textContent!.length;
            node = walker.nextNode()!;
        }
        range.setEnd(node, rest);
        muya.domNode.focus();
        selection.removeAllRanges();
        selection.addRange(range);
        const rect = range.getClientRects()[0];
        const targetWalker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
        let last = targetWalker.nextNode()!;
        for (let next = targetWalker.nextNode(); next; next = targetWalker.nextNode())
            last = next;
        const caret = document.createRange();
        caret.setStart(last, last.textContent!.length);
        caret.collapse(true);
        const targetRect = caret.getClientRects()[0];
        return {
            from: { x: rect.left + Math.min(rect.width / 2, 8), y: rect.top + rect.height / 2 },
            to: { x: targetRect.left - 1, y: targetRect.top + targetRect.height / 2 },
        };
    }, { sourceIndex, targetIndex, start, end });
}

async function startDrag(page: Page, positions: Awaited<ReturnType<typeof points>>) {
    await page.mouse.move(positions.from.x, positions.from.y);
    await page.mouse.down();
    await page.mouse.move(positions.to.x, positions.to.y, { steps: 8 });
}

test('moves selected text through mouse events and undoes in one step', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget'));
    await startDrag(page, await points(page));
    await expect(page.locator('.mu-text-drop-caret')).toBeVisible();
    await expect.poll(() => getMarkdown(page)).toBe('ABCDE\n\nTarget\n');
    await page.mouse.up();
    await expect.poll(() => getMarkdown(page)).toBe('ADE\n\nTargetBC\n');
    await expect.poll(() => page.evaluate(() => window.muya!.getSelectedText())).toBe('BC');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('ABCDE\n\nTarget\n');
    await expect.poll(() => page.evaluate(() => window.muya!.getSelectedText())).toBe('BC');
    await page.evaluate(() => window.muya!.redo());
    await expect.poll(() => getMarkdown(page)).toBe('ADE\n\nTargetBC\n');
});

test('switches copying with the platform modifier without moving the source', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget'));
    await startDrag(page, await points(page));
    const modifier = await page.evaluate(() => /Mac/.test(navigator.userAgent) ? 'Alt' : 'Control');
    await page.keyboard.down(modifier);
    await expect(page.locator('.mu-text-drag-preview')).toHaveAttribute('data-operation', 'copy');
    await page.mouse.up();
    await page.keyboard.up(modifier);
    await expect.poll(() => getMarkdown(page)).toBe('ABCDE\n\nTargetBC\n');
});

for (const cancel of ['escape', 'outside', 'read-only', 'replace', 'destroy']) {
    test(`cancels safely on ${cancel}`, async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget'));
        await startDrag(page, await points(page));
        if (cancel === 'escape')
            await page.keyboard.press('Escape');
        if (cancel === 'outside')
            await page.mouse.move(3, 3);
        if (cancel === 'read-only')
            await page.evaluate(() => window.muya!.setReadOnly(true));
        if (cancel === 'replace')
            await page.evaluate(() => window.muya!.setContent('Replacement'));
        if (cancel === 'destroy')
            await page.evaluate(() => window.muya!.destroy());
        await page.mouse.up();
        await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0);
        if (cancel !== 'destroy') {
            await expect.poll(() => getMarkdown(page)).toBe(cancel === 'replace' ? 'Replacement\n' : 'ABCDE\n\nTarget\n');
            expect(await page.evaluate(() => window.muya!.editor.history.getHistory().stack.undo.length)).toBe(0);
        }
    });
}

for (const target of ['# Heading', '| Header |\n| --- |\n| Value |']) {
    test(`converts multiline text to inline breaks in ${target}`, async ({ page }) => {
        await page.evaluate(target => window.muya!.setContent(`甲\n乙\n\n${target}`), target);
        await startDrag(page, await points(page, 0, 1, 0, 3));
        await page.mouse.up();
        await expect.poll(() => page.evaluate(() => window.muya!.getSelectedText())).toBe('甲<br>乙');
        expect(await getMarkdown(page)).toContain('甲<br>乙');
    });
}

test('does not move a cross-block selection or allow a native text drag', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('ABCDE\n\nTarget');
        muya.selectAll();
    });
    expect(await page.locator('.mu-content').first().evaluate(node => {
        const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
        return node.dispatchEvent(event);
    })).toBe(false);
    expect(await getMarkdown(page)).toBe('ABCDE\n\nTarget\n');
});

test('a click inside an existing selection places a caret without editing', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget'));
    const positions = await points(page);
    await page.mouse.click(positions.from.x, positions.from.y);
    expect(await getMarkdown(page)).toBe('ABCDE\n\nTarget\n');
    expect(await page.evaluate(() => window.muya!.getSelection()?.context.isCollapsed)).toBe(true);
    await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0);
});

test('window blur cancels and removes the drag UI', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget'));
    await startDrag(page, await points(page));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    expect(await getMarkdown(page)).toBe('ABCDE\n\nTarget\n');
    await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0);
});

test('does not scroll at the editor edge during a drag', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('ABCDE\n\nTarget\n\n' + 'More text\n\n'.repeat(100)));
    const positions = await points(page);
    await startDrag(page, positions);
    const scrollBefore = await page.evaluate(() => [...document.querySelectorAll('*')].reduce((sum, node) => sum + node.scrollTop, 0));
    await page.mouse.move(positions.to.x, 715);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => [...document.querySelectorAll('*')].reduce((sum, node) => sum + node.scrollTop, 0))).toBe(scrollBefore);
    await page.keyboard.press('Escape');
    await page.mouse.up();
});
