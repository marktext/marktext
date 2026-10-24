import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

async function seat(page: import('@playwright/test').Page, offset: number) {
    await page.evaluate((position) => {
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(position, position, true);
    }, offset);
}

test('editing an ATX body preserves its indentation, separators and closing marker through history', async ({ page }) => {
    const source = '  ##\t title  ####  \n';
    await loadMarkdown(page, source);
    await seat(page, source.indexOf('title') + 5);
    await page.keyboard.type('!');
    await expect.poll(() => getMarkdown(page)).toBe(source.replace('title', 'title!'));
    expect(await page.evaluate(() => window.muya!.getTOC()[0].content)).toBe('title!');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(source);
    await page.evaluate(() => window.muya!.redo());
    await expect.poll(() => getMarkdown(page)).toBe(source.replace('title', 'title!'));
});

test('editing Setext text preserves line prefixes and the complete underline', async ({ page }) => {
    const source = '  first  \n second\n  ========  \n';
    await loadMarkdown(page, source);
    await seat(page, source.indexOf('first') + 5);
    await page.keyboard.type('!');
    await expect.poll(() => getMarkdown(page)).toBe(source.replace('first', 'first!'));
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe(source);
});

test('changing an ATX level edits only the opening hashes', async ({ page }) => {
    await loadMarkdown(page, '  ##   title  ####  \n');
    await seat(page, 9);
    await page.evaluate(() => window.muya!.updateParagraph('upgrade heading'));
    await expect.poll(() => getMarkdown(page)).toBe('  #   title  ####  \n');
    await expect(page.locator(editor.atxHeading)).toHaveJSProperty('tagName', 'H1');
});

test('typing a noncanonical ATX line preserves the source and caret', async ({ page }) => {
    await loadMarkdown(page, '');
    await seat(page, 0);
    await page.keyboard.insertText('#   hello ###');
    await expect.poll(() => getMarkdown(page)).toBe('#   hello ###\n');
    await expect(page.locator(editor.atxHeading)).toBeVisible();
    expect(await page.evaluate(() => window.muya!.getCursorOffset())).toEqual({
        anchor: { line: 0, ch: 13 }, focus: { line: 0, ch: 13 },
    });
});

test('Enter inside an ATX body keeps the closing marker on the heading', async ({ page }) => {
    await loadMarkdown(page, '  ##   title rest  ####  \n');
    await seat(page, 12);
    await page.keyboard.press('Enter');
    await expect.poll(() => getMarkdown(page)).toBe('  ##   title  ####  \n\n rest\n');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).toBe('  ##   title rest  ####  \n');
});

test('multi-block paste keeps closing hashes out of the following paragraph', async ({ page }) => {
    await loadMarkdown(page, '##   title rest  ###  \n');
    await seat(page, 10);
    await page.evaluate(() => {
        const event = new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: new DataTransfer(),
        });
        event.clipboardData!.setData('text/plain', 'one\n\ntwo');
        window.muya!.domNode.dispatchEvent(event);
    });
    await expect.poll(() => getMarkdown(page)).toBe('##   titleone  ###  \n\ntwo rest\n');
});

test('an empty closed ATX heading stays empty in rendering and outline', async ({ page }) => {
    await loadMarkdown(page, '## ###\n');
    expect(await getMarkdown(page)).toBe('## ###\n');
    expect(await page.evaluate(() => window.muya!.getTOC()[0].content)).toBe('');
    await seat(page, 3);
    await page.keyboard.press('Enter');
    await expect.poll(() => getMarkdown(page)).toBe('\n');
    await expect(page.locator(editor.paragraph)).toBeVisible();
});

test('NBSP accepted by marked imports without a second parser rejecting it', async ({ page }) => {
    await loadMarkdown(page, '#\u00a0title\n');
    await expect(page.locator(editor.atxHeading)).toBeVisible();
    expect(await getMarkdown(page)).toBe('#\u00a0title\n');
    expect(await page.evaluate(() => window.muya!.getTOC()[0].content)).toBe('title');
});
