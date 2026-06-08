// @vitest-environment happy-dom

import type { ITableCellState, ITableRowState, ITableState } from '../types';
import { describe, expect, it } from 'vitest';
import StateToMarkdown from '../stateToMarkdown';

// Regression coverage ported from marktext#4190 (legacy desktop spec
// `test/unit/specs/export-markdown.spec.ts`, the `ExportMarkdown.normalizeTable`
// cases). A table body row that carried MORE cells than the header crashed the
// legacy `ExportMarkdown.normalizeTable` serializer.
//
// The legacy engine modelled tables as `table > thead/tbody > tr > th/td`
// blocks and serialized them via `ExportMarkdown.normalizeTable`. The new
// @muyajs/core engine models a table as a flat `table > table.row >
// table.cell` state and serializes it via `StateToMarkdown.serializeTable`
// (the first row is the header — there is no thead/tbody split). We construct
// the equivalent malformed state directly because a markdown round trip can
// never produce a ragged table: the GFM block parser already pads/truncates
// every row to the header width, so the only way to exercise the serializer's
// own column-clamping guard is to hand it a malformed state — exactly what the
// legacy spec did by hand-building a block tree.
//
// Expected behavior (matches legacy `normalizeTable`):
//   - never throws on a ragged row,
//   - a body row with extra cells is clamped to the header column count
//     (the extra cell is silently dropped),
//   - a body row with fewer cells than the header is tolerated.

function cell(text: string, align = 'none'): ITableCellState {
    return {
        name: 'table.cell',
        meta: { align },
        text,
    };
}

function row(...texts: string[]): ITableRowState {
    return {
        name: 'table.row',
        children: texts.map(t => cell(t)),
    };
}

function table(header: string[], ...body: string[][]): ITableState {
    return {
        name: 'table',
        children: [row(...header), ...body.map(cells => row(...cells))],
    };
}

function serialize(state: ITableState): string {
    return new StateToMarkdown({ listIndentation: 1 }).generate([state]);
}

describe('table normalization on export (#4190)', () => {
    it('exports a well-formed table without error', () => {
        const t = table(['col1', 'col2'], ['a', 'b'], ['c', 'd']);
        let output = '';
        expect(() => {
            output = serialize(t);
        }).not.toThrow();
        expect(output).toContain('col1');
        expect(output).toContain('col2');
        expect(output).toContain('| a');
        expect(output).toContain('| c');
    });

    it('does not throw when a body row has more cells than the header (extra cell dropped)', () => {
        // Header has 2 columns, the body row has 3 — this crashed the legacy
        // exporter before the #4190 fix.
        const t = table(['col1', 'col2'], ['a', 'b', 'EXTRA']);
        let output = '';
        expect(() => {
            output = serialize(t);
        }).not.toThrow();
        expect(output).toContain('col1');
        expect(output).toContain('col2');
        // The extra cell is clamped away — only the two header columns survive.
        expect(output).not.toContain('EXTRA');
        // Header row, delimiter row, and exactly one body row.
        const tableLines = output.split('\n').filter(line => line.trim().startsWith('|'));
        expect(tableLines).toHaveLength(3);
        // Every emitted row has exactly two columns (3 pipes => 2 cells).
        for (const line of tableLines)
            expect((line.match(/\|/g) ?? []).length).toBe(3);
    });

    it('handles a body row with fewer cells than the header', () => {
        const t = table(['col1', 'col2', 'col3'], ['a']);
        expect(() => serialize(t)).not.toThrow();
        const output = serialize(t);
        expect(output).toContain('col1');
        expect(output).toContain('col2');
        expect(output).toContain('col3');
        expect(output).toContain('| a');
    });
});
