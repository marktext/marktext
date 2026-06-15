import type { ITableCellState, ITableRowState, ITableState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
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

// `align` lives on every cell's `meta.align` ('none' | 'left' | 'center' |
// 'right'). The serializer renders the delimiter row from the *header* row's
// cell aligns: left → ':---', center → ':---:', right → '---:', none → '---'.
function gen(markdown: string): TStateForExport {
    return new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(markdown) as unknown as TStateForExport;
}

type TStateForExport = Parameters<ExportMarkdown['generate']>[0];

describe('serializeTable — column alignment', () => {
    it('renders the delimiter row from per-column align', () => {
        const state = table([
            row([cell('a', 'left'), cell('b', 'center'), cell('c', 'right')]),
            row([cell('1'), cell('2'), cell('3')]),
        ]);

        const md = new ExportMarkdown().generate([state]);
        const delimiterRow = md.split('\n')[1];

        // left → leading colon, no trailing colon.
        expect(delimiterRow).toContain(':---');
        // center → leading and trailing colon.
        expect(delimiterRow).toContain(':---:');
        // right → trailing colon only.
        expect(delimiterRow).toContain('---:');
    });

    it('the header row drives the delimiter, not body rows', () => {
        const state = table([
            row([cell('a', 'center'), cell('b', 'none')]),
            // body-row aligns are ignored by the serializer.
            row([cell('1', 'right'), cell('2', 'left')]),
        ]);

        const md = new ExportMarkdown().generate([state]);
        const delimiterRow = md.split('\n')[1];

        expect(delimiterRow).toContain(':---:');
        // The 'none' column has no colons in its delimiter cell; the dashes
        // are wrapped with a leading and trailing space ('| --- |').
        expect(delimiterRow).toBe('|:---:| --- |');
    });

    it('round-trips a left/center/right table to a byte-stable delimiter row', () => {
        const md
            = '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n';

        const firstPass = new ExportMarkdown().generate(gen(md));
        const secondPass = new ExportMarkdown().generate(gen(firstPass));

        // The parsed aligns survive serialization with the expected markers.
        const delimiterRow = firstPass.split('\n')[1];
        expect(delimiterRow).toBe('|:--- |:---:| ---:|');
        expect(delimiterRow).toContain(':---');
        expect(delimiterRow).toContain(':---:');
        expect(delimiterRow).toContain('---:');

        // Re-parsing the serialized output and serializing again is byte-stable.
        expect(secondPass).toBe(firstPass);
        expect(secondPass.split('\n')[1]).toBe(delimiterRow);
    });
});
