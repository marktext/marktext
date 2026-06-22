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

// Regression for #1983. Column padding used String.prototype.length, so a
// cell containing a combining mark (its code units exceed its visual width)
// was over-measured and broke alignment. Padding must use visual column width.
describe('serializeTable — visual column width (#1983)', () => {
    it('aligns a column whose cells contain combining marks', () => {
        const state = table([
            row([cell('A')]),
            row([cell('nɔx')]),
            row([cell('aʊ̯x')]), // a, ʊ, U+032F combining mark, x — 4 code units, 3 columns
        ]);

        const md = new ExportMarkdown().generate([state]);
        const lines = md.split('\n');

        expect(lines[0]).toBe('| A   |');
        expect(lines[1]).toBe('| --- |');
        expect(lines[2]).toBe('| nɔx |');
        expect(lines[3]).toBe('| aʊ̯x |');
    });

    it('widens a column to fit East-Asian wide characters', () => {
        const state = table([
            row([cell('id')]),
            row([cell('中文')]), // two wide characters → 4 columns
        ]);

        const md = new ExportMarkdown().generate([state]);
        const lines = md.split('\n');

        // Column width is max(visual): 'id' = 2, '中文' = 4 → inner width 4.
        expect(lines[0]).toBe('| id   |');
        expect(lines[1]).toBe('| ---- |');
        expect(lines[2]).toBe('| 中文 |');
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

// Regression for marktext #3563. Typing a literal `|` into a table cell stores
// a bare pipe in the cell's text. `escapeText` used `/([^\\])\|/g`, which
// requires a non-backslash character *before* the pipe, so a pipe at the start
// of a cell — or the second of two consecutive pipes (`||`) — was never escaped.
// On reopening the saved file that unescaped pipe was read as a column
// separator and the following text was dropped (the cell content "eaten").
interface INavNode {
    name: string;
    text?: string;
    children?: INavNode[];
}

describe('serializeTable — pipe escaping (#3563)', () => {
    it('escapes a pipe at the very start of a cell', () => {
        const md = new ExportMarkdown().generate([
            table([row([cell('|lead'), cell('b')])]),
        ]);

        expect(md).toContain('\\|lead');
    });

    it('escapes both of two consecutive pipes in a cell', () => {
        const md = new ExportMarkdown().generate([
            table([row([cell('a||b'), cell('c')])]),
        ]);

        expect(md).toContain('a\\|\\|b');
    });

    it('round-trips a cell starting with a pipe byte-stably without losing columns', () => {
        const built = table([
            row([cell('head1'), cell('head2')]),
            row([cell('|danger'), cell('keep')]),
        ]);
        const md = new ExportMarkdown().generate([built]);
        expect(md).toContain('\\|danger');

        const reparsed = gen(md) as unknown as INavNode[];
        const tableNode = reparsed.find(n => n.name === 'table')!;
        const bodyRow = tableNode.children![1];

        // No phantom column, no content loss or shift into the next cell.
        expect(bodyRow.children).toHaveLength(2);
        expect(bodyRow.children![0].text).toContain('danger');
        expect(bodyRow.children![1].text).toBe('keep');

        // Save -> reopen -> save must be byte-stable; #3563's "reopen eats a
        // chunk" was progressive corruption across this cycle.
        const reserialized = new ExportMarkdown().generate(gen(md));
        expect(reserialized).toBe(md);
    });
});
