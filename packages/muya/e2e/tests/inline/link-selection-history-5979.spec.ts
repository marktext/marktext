import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

const multiline = '[editable](   /edit-target\n  "editable title"  )';
const singleLine = '[editable](/edit-target "editable title")';
const nested = '[outer [inner](/inner)](/outer)';
const innerStart = nested.indexOf('[inner]');
const innerEnd = innerStart + '[inner](/inner)'.length;

async function selectionState(page: Page) {
    return page.evaluate(() => window.muya!.getSelectionState());
}

async function expectVisibleSelection(page: Page) {
    const endpoints = await page.evaluate((hiddenSyntax) => {
        const selection = document.getSelection()!;
        const endpoints: Array<[Node, number]> = [
            [selection.anchorNode!, selection.anchorOffset],
            [selection.focusNode!, selection.focusOffset],
        ];
        return endpoints.map(([endpoint, offset]) => {
            const parent = endpoint instanceof Element ? endpoint : endpoint.parentElement!;
            const range = document.createRange();
            range.setStart(endpoint, offset);
            range.collapse(true);
            return {
                hidden: !!parent.closest(hiddenSyntax),
                visible: Array.from(range.getClientRects()).some(rect => rect.height > 0),
            };
        });
    }, editor.hiddenSyntax);
    expect(endpoints).toEqual([{ hidden: false, visible: true }, { hidden: false, visible: true }]);
}

for (const sample of [
    { name: 'multiline title insertion', source: multiline, anchor: multiline.indexOf('title') + 2 },
    { name: 'single-line title insertion', source: singleLine, anchor: singleLine.indexOf('title') + 2 },
    { name: 'link destination insertion', source: multiline, anchor: multiline.indexOf('/edit-target') + 5 },
    { name: 'nested link opener deletion', source: nested, anchor: innerStart, delete: true },
    { name: 'nested link range replacement', source: nested, anchor: innerStart, focus: innerEnd },
    { name: 'backward nested link range replacement', source: nested, anchor: innerEnd, focus: innerStart },
]) {
    test(`${sample.name} restores visible selection through undo and redo`, async ({ page }) => {
        const focus = sample.focus ?? sample.anchor;
        const start = Math.min(sample.anchor, focus);
        const end = sample.delete ? start + 1 : Math.max(sample.anchor, focus);
        const inserted = sample.delete ? '' : 'X';
        const changed = sample.source.slice(0, start) + inserted + sample.source.slice(end);
        const documentMarkdown = (source: string) => `before\n\n${source}\n\nafter\n`;
        await page.evaluate(({ source, anchor, focus }) => {
            const muya = window.muya!;
            muya.setContent(source);
            const block = muya.editor.scrollPage!.queryBlock([1])!.firstContentInDescendant()!;
            block.setCursor(anchor, focus, true);
        }, { source: documentMarkdown(sample.source), anchor: sample.anchor, focus });
        const before = await selectionState(page);
        await expectVisibleSelection(page);
        if (sample.delete)
            await page.keyboard.press('Delete');
        else
            await page.keyboard.type(inserted);
        await expect.poll(() => getMarkdown(page)).toBe(documentMarkdown(changed));
        const after = await selectionState(page);

        await page.evaluate(() => window.muya!.undo());
        expect(await getMarkdown(page)).toBe(documentMarkdown(sample.source));
        expect(await selectionState(page)).toEqual(before);
        await expectVisibleSelection(page);

        await page.evaluate(() => window.muya!.redo());
        expect(await getMarkdown(page)).toBe(documentMarkdown(changed));
        expect(await selectionState(page)).toEqual(after);
        await expectVisibleSelection(page);

        await page.evaluate(() => window.muya!.undo());
        await page.keyboard.type('Y');
        const replacementEnd = sample.delete ? start : end;
        expect(await getMarkdown(page)).toBe(documentMarkdown(`${sample.source.slice(0, start)}Y${sample.source.slice(replacementEnd)}`));
    });
}
