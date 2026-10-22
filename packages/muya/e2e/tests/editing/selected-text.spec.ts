import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// `muya.getSelectedText()` reads the live native range, so it only says
// anything once the browser has produced one. These cover the interactions a
// host counts words for; the per-container separator rules are unit-tested in
// `src/selection/__tests__/selectedText.spec.ts`.

function selectedText(page: Page): Promise<string> {
    return page.evaluate(() => window.muya!.getSelectedText());
}

async function dragAcrossParagraphs(page: Page): Promise<void> {
    const paragraphs = page.locator(editor.paragraph);
    const first = (await paragraphs.first().boundingBox())!;
    const last = (await paragraphs.last().boundingBox())!;
    await page.mouse.move(first.x + 1, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width - 1, last.y + last.height / 2, { steps: 8 });
    await page.mouse.up();
}

test('reports a dragged selection within one paragraph', async ({ page }) => {
    await loadMarkdown(page, 'Alpha beta gamma\n');
    await dragAcrossParagraphs(page);

    expect(await selectedText(page)).toBe('Alpha beta gamma');
});

test('joins paragraphs with a blank line', async ({ page }) => {
    await loadMarkdown(page, 'First paragraph\n\nSecond paragraph\n');
    await dragAcrossParagraphs(page);

    expect(await selectedText(page)).toBe('First paragraph\n\nSecond paragraph');
});

test('reports the source of a rendered formula, not its rendering', async ({ page }) => {
    await loadMarkdown(page, 'mass energy $E = mc^2$ equivalence\n');
    await dragAcrossParagraphs(page);

    expect(await selectedText(page)).toBe('mass energy $E = mc^2$ equivalence');
});

// A rendered preview is `contenteditable="false"`, so a range that starts or
// ends on one resolves to no content block at all — which a paragraph holding
// nothing else always does. Pinned until the Selection rework maps preview
// boundaries back to source offsets.
test('reports nothing for a paragraph that is only a formula', async ({ page }) => {
    await loadMarkdown(page, '$E = mc^2$\n');
    await dragAcrossParagraphs(page);

    expect(await selectedText(page)).toBe('');
});

test('grows with a keyboard selection and empties with the caret', async ({ page }) => {
    await loadMarkdown(page, 'Alpha beta\n');
    await page.locator(editor.paragraph).click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    expect(await selectedText(page)).toBe('Al');

    await page.keyboard.press('ArrowRight');
    expect(await selectedText(page)).toBe('');
});

test('reports nothing for a selection outside the editor', async ({ page }) => {
    await loadMarkdown(page, 'Alpha beta gamma\n');
    await dragAcrossParagraphs(page);
    expect(await selectedText(page)).toBe('Alpha beta gamma');

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

    expect(await selectedText(page)).toBe('');
});
