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

for (const pasted of ['one\n\ntwo', '# one\n\ntwo', '- one\n\ntwo']) {
    test(`structural paste ${JSON.stringify(pasted)} keeps closing hashes on the heading`, async ({ page }) => {
        await loadMarkdown(page, '##   title rest  ###  \n');
        await seat(page, 10);
        await page.evaluate((text) => {
            const event = new ClipboardEvent('paste', {
                bubbles: true, cancelable: true, clipboardData: new DataTransfer(),
            });
            event.clipboardData!.setData('text/plain', text);
            window.muya!.domNode.dispatchEvent(event);
        }, pasted);
        const expected = pasted.startsWith('-')
            ? '##   title  ###  \n\n- one\n\ntwo rest\n'
            : '##   titleone  ###  \n\ntwo rest\n';
        await expect.poll(() => getMarkdown(page)).toBe(expected);
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe('##   title rest  ###  \n');
        await page.evaluate(() => window.muya!.redo());
        await expect.poll(() => getMarkdown(page)).toBe(expected);
    });
}

for (const [start, end] of [[4, 4], [4, 6]]) {
    test(`paragraph conversion preserves body selection ${start}–${end}`, async ({ page }) => {
        await loadMarkdown(page, '# title  ###  \n');
        await page.evaluate(([from, to]) => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(from, to, true);
            window.muya!.updateParagraph('paragraph');
        }, [start, end]);
        expect(await getMarkdown(page)).toBe('title\n');
        expect(await page.evaluate(() => window.muya!.getCursorOffset())).toEqual({
            anchor: { line: 0, ch: start - 2 }, focus: { line: 0, ch: end - 2 },
        });
        expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('title'.slice(start - 2, end - 2));
    });
}

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

for (const source of ['# title ###\n', '  ##   title  ###  \n']) {
    test(`formatting a whole heading excludes its closing syntax: ${JSON.stringify(source)}`, async ({ page }) => {
        await loadMarkdown(page, source);
        await page.evaluate(() => {
            const content = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            content.setCursor(0, content.text.length, true);
            window.muya!.format('strong');
        });
        await expect.poll(() => getMarkdown(page)).toBe(source.replace('title', '**title**'));
    });
}

test('formatting across blocks excludes heading delimiters', async ({ page }) => {
    await loadMarkdown(page, '# title ###\n\nother\n');
    await page.evaluate(() => {
        const muya = window.muya!;
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const last = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { block: first, path: first.path, offset: 0 },
            { block: last, path: last.path, offset: last.text.length },
        );
        muya.format('strong');
    });
    await expect.poll(() => getMarkdown(page)).toBe('# **title** ###\n\n**other**\n');
});

for (const [source, start, end] of [
    ['# title ###\n', 0, 2],
    ['# title ###\n', 7, 11],
    ['#\n', 1, 1],
    ['## ###\n', 3, 3],
] as const) {
    test(`formatting syntax-only or empty heading content is a no-op: ${JSON.stringify([source, start, end])}`, async ({ page }) => {
        await loadMarkdown(page, source);
        await page.evaluate(([from, to]) => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(from, to, true);
            window.muya!.format('strong');
        }, [start, end]);
        expect(await getMarkdown(page)).toBe(source);
    });
}

test('formatting at the heading body end keeps the closing marker separate', async ({ page }) => {
    await loadMarkdown(page, '# title ###\n');
    await seat(page, 7);
    await page.evaluate(() => window.muya!.format('strong'));
    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toBe('# title**X** ###\n');
});

test('converting an indented paragraph keeps the real typing position', async ({ page }) => {
    await loadMarkdown(page, '  title\n');
    await seat(page, 4);
    await page.evaluate(() => window.muya!.updateParagraph('heading 2'));
    expect(await page.evaluate(() => window.muya!.getCursorOffset())).toEqual({
        anchor: { line: 0, ch: 7 }, focus: { line: 0, ch: 7 },
    });
    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toBe('##   tiXtle\n');
});

test('definition-shaped heading text remains visible in the outline', async ({ page }) => {
    await loadMarkdown(page, '# [x]: https://example.com\n');
    const heading = await page.evaluate(() => window.muya!.getTOC()[0]);
    expect(heading.content).toBe('[x]: https://example.com');
    expect(heading.githubSlug).toBe('x-httpsexamplecom');
});
