// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Table from '../../block/gfm/table';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Port of the legacy `packages/muyajs` `selectAll` behavior
// (`contentState/paragraphCtrl.js`). Cmd+A escalates level-by-level:
//   - cursor inside a single table cell      → freeze that 1x1 cell
//   - one cell already frozen                → select the whole table
//   - whole table already frozen             → clear + select whole document
//   - selection spanning two cells (same)    → select the whole table
//   - selection spanning two DIFFERENT tables → no-op (don't select document)
// Code / language-input content blocks clamp inside their own block and stay
// idempotent on repeated Cmd+A (never escalate to the whole document).

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
        const { selection, tableSelection } = muya.editor;

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
        const { selection, tableSelection } = muya.editor;

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
        const { selection, tableSelection } = muya.editor;
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
        const { selection, tableSelection } = muya.editor;
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

    it('selecting two cells of the SAME table escalates to the whole table', () => {
        const muya = bootMuya(TABLE_MD);
        const table = getTable(muya);
        const { selection, tableSelection } = muya.editor;

        const a = cellContent(table, 0, 0);
        const b = cellContent(table, 1, 1);
        selection.setSelection({
            anchor: { offset: 0 },
            focus: { offset: b.text.length },
            anchorBlock: a,
            anchorPath: a.path,
            focusBlock: b,
            focusPath: b.path,
        });

        selection.selectAll();

        expect(tableSelection.hasSelection).toBe(true);
        expect(tableSelection.isWholeTableSelected()).toBe(true);
    });

    it('selecting cells across TWO different tables is a no-op (no document selection)', () => {
        const muya = bootMuya(`${TABLE_MD}\n${TABLE_MD}`);
        const sp = muya.editor.scrollPage!;
        const { selection, tableSelection } = muya.editor;

        // Two distinct tables in the document.
        const firstContent = sp.firstContentInDescendant()!;
        const firstTable = firstContent.closestBlock('table') as Table;
        const lastContent = sp.lastContentInDescendant()!;
        const secondTable = lastContent.closestBlock('table') as Table;
        expect(firstTable).not.toBe(secondTable);

        const a = cellContent(firstTable, 0, 0);
        const b = cellContent(secondTable, 0, 0);
        selection.setSelection({
            anchor: { offset: 0 },
            focus: { offset: b.text.length },
            anchorBlock: a,
            anchorPath: a.path,
            focusBlock: b,
            focusPath: b.path,
        });

        selection.selectAll();

        // No table selection frozen and no whole-document escalation.
        expect(tableSelection.hasSelection).toBe(false);
        expect(selection.anchorBlock).toBe(a);
        expect(selection.focusBlock).toBe(b);
    });
});

describe('selection.selectAll code / language clamp', () => {
    it('clamps inside a code block and stays idempotent on repeated Cmd+A', () => {
        const muya = bootMuya('```js\nconst a = 1\nconst b = 2\n```\n');
        const sp = muya.editor.scrollPage!;
        const codeLeaf = sp.lastContentInDescendant()!;
        const { selection } = muya.editor;

        codeLeaf.setCursor(0, 3, false);

        selection.selectAll();
        expect(selection.anchorBlock).toBe(codeLeaf);
        expect(selection.focusBlock).toBe(codeLeaf);
        expect(selection.anchor!.offset).toBe(0);
        expect(selection.focus!.offset).toBe(codeLeaf.text.length);

        // Second Cmd+A: stays clamped inside the code block (no document).
        selection.selectAll();
        expect(selection.anchorBlock).toBe(codeLeaf);
        expect(selection.focusBlock).toBe(codeLeaf);
        expect(selection.focus!.offset).toBe(codeLeaf.text.length);
    });

    it('clamps inside the language-input and stays idempotent on repeated Cmd+A', () => {
        const muya = bootMuya('```js\nconst a = 1\n```\n');
        const sp = muya.editor.scrollPage!;
        const langInput = sp.firstContentInDescendant()!;
        expect(langInput.blockName).toBe('language-input');
        const { selection } = muya.editor;

        langInput.setCursor(0, 0, false);

        selection.selectAll();
        expect(selection.anchorBlock).toBe(langInput);
        expect(selection.focusBlock).toBe(langInput);
        expect(selection.anchor!.offset).toBe(0);
        expect(selection.focus!.offset).toBe(langInput.text.length);

        selection.selectAll();
        expect(selection.anchorBlock).toBe(langInput);
        expect(selection.focusBlock).toBe(langInput);
        expect(selection.focus!.offset).toBe(langInput.text.length);
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
