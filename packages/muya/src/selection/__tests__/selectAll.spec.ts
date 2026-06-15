// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Table from '../../block/gfm/table';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// `selectAll` escalates through three rules:
//   1. A frozen rectangular table selection: a partial rectangle (single cell
//      included) grows to the whole table; the whole table jumps to the whole
//      document.
//   2. A caret/selection inside a single content block: a table cell freezes as
//      a 1x1 rectangle; any other block (paragraph, heading, code, …) grows to
//      the whole block, then to the whole document.
//   3. A selection spanning multiple content blocks (two cells of the same
//      table, cells of different tables, or plain paragraphs) goes straight to
//      the whole document.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

const TABLE_MD = '| a | b |\n| --- | --- |\n| c | d |\n';

function getTable(muya: Muya): Table {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    return first.closestBlock('table') as Table;
}

function cellContent(table: Table, row: number, column: number): Content {
    return table.cellAt(row, column)!.firstChild as unknown as Content;
}

describe('selection.selectAll table escalation', () => {
    it('cursor inside a single cell freezes that 1x1 cell (no document selection)', () => {
        const muya = bootMuya(TABLE_MD);
        const table = getTable(muya);
        const { selection } = muya.editor;
        const tableSelection = selection.table;

        // Caret inside the (0,0) cell content.
        cellContent(table, 0, 0).setCursor(0, 0, false);

        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(true);
        expect(tableSelection.isSingleCellSelected()).toBe(true);
        expect(tableSelection.isWholeTableSelected()).toBe(false);
    });

    it('escalates a frozen single cell to the whole table on the next Cmd+A', () => {
        const muya = bootMuya(TABLE_MD);
        const table = getTable(muya);
        const { selection } = muya.editor;
        const tableSelection = selection.table;

        cellContent(table, 0, 0).setCursor(0, 0, false);
        selection.selectAll();
        expect(tableSelection.isSingleCellSelected()).toBe(true);

        // Second Cmd+A: single cell → whole table.
        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(true);
        expect(tableSelection.isWholeTableSelected()).toBe(true);
        expect(tableSelection.isSingleCellSelected()).toBe(false);
    });

    it('escalates a frozen whole table to the whole document and clears the table selection', () => {
        const muya = bootMuya(`${TABLE_MD}\nbelow\n`);
        const table = getTable(muya);
        const { selection } = muya.editor;
        const tableSelection = selection.table;
        const sp = muya.editor.scrollPage!;

        tableSelection.selectTable(table);
        expect(tableSelection.isWholeTableSelected()).toBe(true);

        // Third Cmd+A: whole table → whole document.
        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(false);
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });

    it('escalates cell → whole table → whole document across three sequential Cmd+A presses', () => {
        const muya = bootMuya(`${TABLE_MD}\nbelow\n`);
        const table = getTable(muya);
        const { selection } = muya.editor;
        const tableSelection = selection.table;
        const sp = muya.editor.scrollPage!;

        cellContent(table, 0, 0).setCursor(0, 0, false);

        selection.selectAll();
        expect(tableSelection.isSingleCellSelected()).toBe(true);

        selection.selectAll();
        expect(tableSelection.isWholeTableSelected()).toBe(true);

        selection.selectAll();
        expect(tableSelection.hasSelection).toBe(false);
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });

    it('selecting two cells of the SAME table escalates to the whole document', () => {
        const muya = bootMuya(`${TABLE_MD}\nbelow\n`);
        const table = getTable(muya);
        const { selection } = muya.editor;
        const tableSelection = selection.table;
        const sp = muya.editor.scrollPage!;

        const a = cellContent(table, 0, 0);
        const b = cellContent(table, 1, 1);
        selection.setSelection(
            { offset: 0, block: a, path: a.path },
            { offset: b.text.length, block: b, path: b.path },
        );

        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(false);
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });

    it('selecting cells across TWO different tables escalates to the whole document', () => {
        const muya = bootMuya(`${TABLE_MD}\n${TABLE_MD}`);
        const sp = muya.editor.scrollPage!;
        const { selection } = muya.editor;
        const tableSelection = selection.table;

        // Two distinct tables in the document.
        const firstContent = sp.firstContentInDescendant()!;
        const firstTable = firstContent.closestBlock('table') as Table;
        const lastContent = sp.lastContentInDescendant()!;
        const secondTable = lastContent.closestBlock('table') as Table;
        expect(firstTable).not.toBe(secondTable);

        const a = cellContent(firstTable, 0, 0);
        const b = cellContent(secondTable, 0, 0);
        selection.setSelection(
            { offset: 0, block: a, path: a.path },
            { offset: b.text.length, block: b, path: b.path },
        );

        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(false);
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });
});

describe('selection.selectAll code / language blocks', () => {
    it('selects the whole code block first, then escalates to the whole document', () => {
        const muya = bootMuya('```js\nconst a = 1\nconst b = 2\n```\n');
        const sp = muya.editor.scrollPage!;
        const codeLeaf = sp.lastContentInDescendant()!;
        const { selection } = muya.editor;

        codeLeaf.setCursor(0, 3, false);

        // First Cmd+A selects the whole code block content.
        selection.selectAll();
        expect(selection.anchorBlock).toBe(codeLeaf);
        expect(selection.focusBlock).toBe(codeLeaf);
        expect(selection.anchor!.offset).toBe(0);
        expect(selection.focus!.offset).toBe(codeLeaf.text.length);

        // Second Cmd+A escalates to the whole document.
        selection.selectAll();
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });

    it('selects the whole language-input first, then escalates to the whole document', () => {
        const muya = bootMuya('```js\nconst a = 1\n```\n\nbelow\n');
        const sp = muya.editor.scrollPage!;
        const langInput = sp.firstContentInDescendant()!;
        expect(langInput.blockName).toBe('language-input');
        expect(langInput.text).toBe('js');
        const { selection } = muya.editor;

        langInput.setCursor(0, 0, false);

        // First Cmd+A selects the whole language-input content ("js").
        selection.selectAll();
        expect(selection.anchorBlock).toBe(langInput);
        expect(selection.focusBlock).toBe(langInput);
        expect(selection.anchor!.offset).toBe(0);
        expect(selection.focus!.offset).toBe(langInput.text.length);

        // Second Cmd+A escalates to the whole document.
        selection.selectAll();
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });

    it('plain paragraph still escalates to the whole document', () => {
        const muya = bootMuya('hello world\n\nsecond line\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const { selection } = muya.editor;

        // First Cmd+A selects the line; assert it selects the whole block.
        first.setCursor(0, 0, false);
        selection.selectAll();
        expect(selection.anchorBlock).toBe(first);
        expect(selection.focusBlock).toBe(first);

        // Second Cmd+A escalates to the whole document.
        selection.selectAll();
        expect(selection.anchorBlock).toBe(sp.firstContentInDescendant());
        expect(selection.focusBlock).toBe(sp.lastContentInDescendant());
    });
});
