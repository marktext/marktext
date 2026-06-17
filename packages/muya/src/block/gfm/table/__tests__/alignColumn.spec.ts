// @vitest-environment happy-dom

import type TableBodyCell from '../cell';
import type Table from '../index';
import type TableRow from '../row';
import type TableInner from '../table';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// Coverage for `Table.alignColumn`. The migration audit noted the insert /
// remove row-column paths are unit-tested (insertRowColumn.spec.ts /
// removeRowColumn.spec.ts) but the per-column alignment API the floating
// table toolbar drives had no direct test. `alignColumn(offset, value)`
// toggles a column between the requested alignment and 'none', writes both
// the cell `meta.align` (state) and the `data-align` DOM attribute, and
// dispatches an OT op so the serialized delimiter row reflects the change.
// These tests boot a real table and assert the resulting per-cell state,
// dataset, and round-tripped delimiter so a regression that drops the toggle
// or the DOM/state sync is caught.

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

function findTable(muya: Muya): Table {
    let table: Table | null = null;
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

// Collect every cell in a given column (header + body) off the live block tree.
function cellsInColumn(table: Table, column: number): TableBodyCell[] {
    const inner = table.firstChild as TableInner;
    const cells: TableBodyCell[] = [];
    inner.forEach((row) => {
        cells.push((row as TableRow).find(column) as TableBodyCell);
    });
    return cells;
}

// A plain 2-column table with no explicit alignment — both columns parse as
// align 'none'.
const PLAIN_TABLE = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';

describe('table.alignColumn', () => {
    it('sets meta.align and the data-align attribute on every cell in the column', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'center');

        await flush();
        for (const cell of cellsInColumn(table, 0)) {
            expect(cell.meta.align).toBe('center');
            expect(cell.align).toBe('center');
            expect(cell.domNode!.dataset.align).toBe('center');
        }
        // Column 1 is untouched.
        for (const cell of cellsInColumn(table, 1))
            expect(cell.meta.align).toBe('none');
    });

    it('reflects the requested alignment in the getState() per-cell meta', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'center');

        await flush();
        const state = table.getState();
        for (const row of state.children)
            expect(row.children[0].meta.align).toBe('center');
    });

    it('serializes a center-aligned column as a :---: delimiter', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'center');

        await flush();
        const md = muya.getMarkdown();
        expect(md).toContain(':---:');
    });

    it('toggles the column back to none when alignColumn is called twice with the same value', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'center');
        await flush();
        expect(md(muya)).toContain(':---:');

        // Calling again with the same value toggles back to 'none'.
        table.alignColumn(0, 'center');
        await flush();

        for (const cell of cellsInColumn(table, 0)) {
            expect(cell.meta.align).toBe('none');
            expect(cell.domNode!.dataset.align).toBe('none');
        }
        // The center delimiter is gone; the default un-aligned delimiter row
        // (only dashes, no colons) is serialized.
        expect(md(muya)).not.toContain(':---:');
        expect(md(muya)).toContain('---');
    });

    it('serializes a right-aligned column as a ---: delimiter', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(1, 'right');

        await flush();
        for (const cell of cellsInColumn(table, 1))
            expect(cell.meta.align).toBe('right');

        const markdown = muya.getMarkdown();
        expect(markdown).toContain('---:');
        // Column 0 stays unaligned, so no left/center markers appear.
        expect(markdown).not.toContain(':---:');
    });

    it('serializes a left-aligned column as a :--- delimiter', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'left');

        await flush();
        for (const cell of cellsInColumn(table, 0))
            expect(cell.meta.align).toBe('left');

        expect(muya.getMarkdown()).toContain(':---');
    });

    it('switches directly between non-none alignments without toggling off', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);

        table.alignColumn(0, 'center');
        await flush();
        // A different value than the current one — should set it, not toggle.
        table.alignColumn(0, 'right');
        await flush();

        for (const cell of cellsInColumn(table, 0))
            expect(cell.meta.align).toBe('right');
    });

    it('is a no-op for an out-of-range column offset', async () => {
        const muya = bootMuya(PLAIN_TABLE);
        const table = findTable(muya);
        expect(table.columnCount).toBe(2);

        table.alignColumn(5, 'center');

        await flush();
        // Nothing changed: both columns stay 'none'.
        for (let col = 0; col < table.columnCount; col++) {
            for (const cell of cellsInColumn(table, col))
                expect(cell.meta.align).toBe('none');
        }
    });
});

function md(muya: Muya): string {
    return muya.getMarkdown();
}
