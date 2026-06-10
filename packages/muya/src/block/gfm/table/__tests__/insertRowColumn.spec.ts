// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// Coverage for `Table.insertRow` / `Table.insertColumn`. The migration audit
// noted only the REMOVAL paths are unit-tested (removeRowColumn.spec.ts) — the
// insertion paths, which the floating table toolbar / row-column menu drive,
// had no direct test. A miscount here silently mis-shapes the table or drops
// per-column alignment. These tests boot a real table and assert the resulting
// shape, alignment inheritance, and the returned caret cell so the toolbar can
// place the cursor in the new cell.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
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
    bootedHosts.push(muya.domNode);
    return muya;
}

// eslint-disable-next-line ts/no-explicit-any
function findTable(muya: Muya): any {
    // eslint-disable-next-line ts/no-explicit-any
    let table: any = null;
    // eslint-disable-next-line ts/no-explicit-any
    const visit = (block: any) => {
        if (block.constructor?.blockName === 'table')
            table = block;
        // eslint-disable-next-line ts/no-explicit-any
        block.children?.forEach((c: any) => visit(c));
    };
    visit(muya.editor.scrollPage);
    if (!table)
        throw new Error('no table found');
    return table;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

// A 1-header + 1-body table whose two columns are left- and right-aligned.
const ALIGNED_TABLE = '| a | b |\n| :--- | ---: |\n| 1 | 2 |\n';

describe('table.insertRow', () => {
    it('inserts an empty body row and grows the row count', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);
        expect(table.rowCount).toBe(2);

        table.insertRow(1);

        await flush();
        expect(table.rowCount).toBe(3);
        // The new row carries the same column count, all cells empty.
        const state = table.getState();
        const newRow = state.children[1];
        expect(newRow.children.length).toBe(2);
        expect(newRow.children.every((c: { text: string }) => c.text === '')).toBe(true);
    });

    it('inherits the header row\'s per-column alignment in the new row', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);

        table.insertRow(1);

        await flush();
        const state = table.getState();
        const newRow = state.children[1];
        // Column 0 is left-aligned, column 1 right-aligned in the header — the
        // inserted row's cells copy that.
        expect(newRow.children[0].meta.align).toBe('left');
        expect(newRow.children[1].meta.align).toBe('right');
    });

    it('returns the first cell content of the new row for caret placement', () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);

        const caretCell = table.insertRow(1);

        expect(caretCell).toBeTruthy();
        expect(caretCell.constructor.blockName).toBe('table.cell.content');
        expect(caretCell.text).toBe('');
    });

    it('round-trips the alignment delimiter row after the insert', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        findTable(muya).insertRow(1);

        await flush();
        const md = muya.getMarkdown();
        // The :--- (left) / ---: (right) delimiter survives the row insert.
        expect(md).toContain(':---');
        expect(md).toContain('---:');
    });
});

describe('table.insertColumn', () => {
    it('inserts an empty column and grows the column count', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);
        expect(table.columnCount).toBe(2);

        table.insertColumn(1, 'center');

        await flush();
        expect(table.columnCount).toBe(3);
        // Every row gained one empty cell.
        const state = table.getState();
        for (const row of state.children)
            expect(row.children.length).toBe(3);
    });

    it('applies the requested alignment to the whole new column', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);

        table.insertColumn(1, 'center');

        await flush();
        const state = table.getState();
        // The inserted column (index 1) is center-aligned in every row.
        for (const row of state.children)
            expect(row.children[1].meta.align).toBe('center');
    });

    it('returns the new column\'s first cell content for caret placement', () => {
        const muya = bootMuya(ALIGNED_TABLE);
        const table = findTable(muya);

        const caretCell = table.insertColumn(1, 'center');

        expect(caretCell).toBeTruthy();
        expect(caretCell.constructor.blockName).toBe('table.cell.content');
        expect(caretCell.text).toBe('');
    });

    it('serializes the new center column as a :---: delimiter between the existing ones', async () => {
        const muya = bootMuya(ALIGNED_TABLE);
        findTable(muya).insertColumn(1, 'center');

        await flush();
        const md = muya.getMarkdown();
        // Delimiter row now reads left | center | right.
        expect(md).toContain(':---:');
    });
});
