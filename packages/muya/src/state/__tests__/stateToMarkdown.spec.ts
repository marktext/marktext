import type { ITableCellState, ITableRowState, ITableState } from '../types';
import { describe, expect, it } from 'vitest';
import ExportMarkdown from '../stateToMarkdown';

function cell(text: string, align = 'none'): ITableCellState {
    return {
        name: 'table.cell',
        meta: { align },
        text,
    };
}

function row(cells: ITableCellState[]): ITableRowState {
    return {
        name: 'table.row',
        children: cells,
    };
}

function table(rows: ITableRowState[]): ITableState {
    return {
        name: 'table',
        children: rows,
    };
}

// Regression for marktext commit 9884342f (#4222 / #4190).
// `normalizeTable` previously crashed with
//   TypeError: Cannot read properties of undefined (reading 'width')
// when a body row had more cells than the header, or
//   TypeError: Cannot read properties of undefined (reading 'length')
// when a body row had fewer cells than the header.
describe('serializeTable — row width mismatch', () => {
    it('does not crash when a body row has more cells than the header', () => {
        const state = table([
            row([cell('a'), cell('b')]),
            row([cell('1'), cell('2'), cell('3'), cell('4')]),
        ]);

        const md = new ExportMarkdown().generate([state]);

        expect(md).toContain('| a');
        expect(md).toContain('| b');
        expect(md).not.toContain('| 3');
        expect(md).not.toContain('| 4');
    });

    it('does not crash when a body row has fewer cells than the header', () => {
        const state = table([
            row([cell('a'), cell('b'), cell('c')]),
            row([cell('1')]),
        ]);

        const md = new ExportMarkdown().generate([state]);

        expect(md).toContain('| a');
        expect(md).toContain('| c');
        expect(md).toContain('| 1');
    });

    it('serialises a well-formed table normally', () => {
        const state = table([
            row([cell('a'), cell('b')]),
            row([cell('1'), cell('2')]),
        ]);

        const md = new ExportMarkdown().generate([state]);

        expect(md).toContain('| a');
        expect(md).toContain('| b');
        expect(md).toContain('| 1');
        expect(md).toContain('| 2');
    });
});
