import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

interface SelectionNotification {
    type?: string;
    anchorText?: string;
    focusText?: string;
    anchorOffset?: number;
    focusOffset?: number;
    direction?: string;
    selectedText: string;
}

declare global {
    interface Window {
        __selectionNotifications: SelectionNotification[];
    }
}

let pageErrors: string[] = [];
test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
});
test.afterEach(() => {
    expect(pageErrors).toEqual([]);
});

async function recordSelection(page: Page, markdown: string): Promise<void> {
    await page.evaluate((markdown) => {
        window.muya!.setContent(markdown);
        window.__selectionNotifications = [];
        window.muya!.on('selection-change', (payload: unknown) => {
            const change = payload as {
                type?: string;
                anchorBlock?: { text: string };
                focusBlock?: { text: string };
                anchor?: { offset: number };
                focus?: { offset: number };
                direction?: string;
            };
            window.__selectionNotifications.push({
                type: change.type,
                anchorText: change.anchorBlock?.text,
                focusText: change.focusBlock?.text,
                anchorOffset: change.anchor?.offset,
                focusOffset: change.focus?.offset,
                direction: change.direction,
                selectedText: window.muya!.getSelectedText(),
            });
        });
    }, markdown);
}

async function latestSelection(page: Page): Promise<SelectionNotification | null> {
    return page.evaluate(() => {
        const events = window.__selectionNotifications;
        return events[events.length - 1] ?? null;
    });
}

async function startParagraphDrag(page: Page): Promise<void> {
    const paragraphs = page.locator(editor.paragraph);
    const first = (await paragraphs.first().boundingBox())!;
    const last = (await paragraphs.last().boundingBox())!;
    await page.mouse.move(first.x + 1, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width - 1, last.y + last.height / 2, { steps: 8 });
}

test('reports a text selection before the mouse is released', async ({ page }) => {
    await recordSelection(page, 'Alpha beta gamma\n');
    await startParagraphDrag(page);
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Range', anchorOffset: 0, focusOffset: 16, selectedText: 'Alpha beta gamma',
    });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('Alpha beta gamma');
    await page.mouse.up();
});

test('maps a rendered formula selection to its source offsets', async ({ page }) => {
    await recordSelection(page, '$E = mc^2$\n');
    await startParagraphDrag(page);
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Range', anchorText: '$E = mc^2$', anchorOffset: 1, focusOffset: 9, selectedText: 'E = mc^2',
    });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('E = mc^2');
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Range', anchorOffset: 1, focusOffset: 9,
    });
});

test('reports both endpoints while dragging across paragraphs', async ({ page }) => {
    await recordSelection(page, 'First paragraph\n\nSecond paragraph\n');
    await startParagraphDrag(page);
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Range', anchorText: 'First paragraph', focusText: 'Second paragraph',
        anchorOffset: 0, focusOffset: 16,
        selectedText: 'First paragraph\n\nSecond paragraph',
    });
    await page.mouse.up();
});

test('reports paragraph-boundary ranges and ignores unchanged native notifications', async ({ page }) => {
    await recordSelection(page, 'Alpha beta gamma\n');
    await page.evaluate(() => {
        const paragraph = document.querySelector('#editor .mu-paragraph')!;
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Range', anchorOffset: 0, focusOffset: 16,
    });
    const unchanged = await page.evaluate(() => {
        const count = window.__selectionNotifications.length;
        document.dispatchEvent(new Event('selectionchange'));
        return window.__selectionNotifications.length === count;
    });
    expect(unchanged).toBe(true);
});

test('emits once when an API selection is followed by the native notification', async ({ page }) => {
    await recordSelection(page, 'Alpha beta gamma\n');
    await page.evaluate(() => {
        window.__selectionNotifications = [];
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 5);
    });
    await expect.poll(() => latestSelection(page)).toMatchObject({ type: 'Range', selectedText: 'Alpha' });
    // A frame boundary lets the browser deliver the queued selectionchange.
    const count = await page.evaluate(() => new Promise<number>((resolve) => {
        requestAnimationFrame(() => resolve(window.__selectionNotifications.length));
    }));
    expect(count).toBe(1);
});

test('reports the cleared editor selection when selecting outside the editor', async ({ page }) => {
    await recordSelection(page, 'Alpha beta gamma\n');
    await startParagraphDrag(page);
    await page.mouse.up();
    await expect.poll(() => latestSelection(page)).toMatchObject({ type: 'Range' });
    await page.evaluate(() => {
        const outside = document.createElement('p');
        outside.textContent = 'Outside the editor';
        document.body.appendChild(outside);
        const range = document.createRange();
        range.selectNodeContents(outside);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await expect.poll(() => latestSelection(page)).toMatchObject({ type: 'None', selectedText: '' });
});

for (const { markdown, selector, selectedText, start, end } of [
    { markdown: '$E = mc^2$\n', selector: '.mu-math-render', selectedText: 'E = mc^2', start: 1, end: 9 },
    { markdown: '<ruby>漢<rt>kan</rt></ruby>\n', selector: '.mu-ruby-render', selectedText: '漢<rt>kan</rt>', start: 6, end: 19 },
]) {
    test(`maps backward and collapsed ranges inside ${selector}`, async ({ page }) => {
        await recordSelection(page, markdown);
        await page.evaluate((selector) => {
            const preview = document.querySelector(selector)!;
            window.getSelection()!.setBaseAndExtent(preview, preview.childNodes.length, preview, 0);
        }, selector);
        await expect.poll(() => latestSelection(page)).toMatchObject({
            type: 'Range', direction: 'backward', anchorOffset: end, focusOffset: start, selectedText,
        });

        await page.evaluate((selector) => {
            const preview = document.querySelector(selector)!;
            window.getSelection()!.collapse(preview, 0);
        }, selector);
        await expect.poll(() => latestSelection(page)).toMatchObject({
            type: 'Caret', direction: 'none', anchorOffset: start, focusOffset: start, selectedText: '',
        });
    });
}

test('defers native notifications until IME text is committed', async ({ page }) => {
    await recordSelection(page, 'hello ');
    await page.locator(editor.paragraph).click();
    await page.keyboard.press('End');
    await expect.poll(() => latestSelection(page)).toMatchObject({ type: 'Caret', anchorOffset: 6 });

    const preedit = await page.evaluate(() => {
        const block = window.muya!.editor.activeContentBlock!;
        const node = block.domNode!;
        node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        const count = window.__selectionNotifications.length;
        node.textContent = 'hello nihao';
        window.getSelection()!.setBaseAndExtent(node.firstChild!, 6, node.firstChild!, 11);
        node.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertCompositionText', data: 'nihao', isComposing: true,
        }));
        document.dispatchEvent(new Event('selectionchange'));
        return { text: block.text, count, after: window.__selectionNotifications.length };
    });
    expect(preedit.text).toBe('hello ');
    expect(preedit.after).toBe(preedit.count);

    await page.evaluate(() => {
        const node = window.muya!.editor.activeContentBlock!.domNode!;
        node.textContent = 'hello 你好';
        window.getSelection()!.collapse(node.firstChild!, 8);
        node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }));
        node.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertCompositionText', data: '你好', isComposing: false,
        }));
    });
    await expect.poll(() => latestSelection(page)).toMatchObject({
        type: 'Caret', anchorText: 'hello 你好', anchorOffset: 8, selectedText: '',
    });
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(() => latestSelection(page)).toMatchObject({ type: 'Range', selectedText: '你好' });
});
