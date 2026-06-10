import type { Muya } from '../../../muya';
import type { ITableRowState, ITableState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type Content from '../../base/content';
import type TableCellContent from '../../content/tableCell';
import type { TBlockPath } from '../../types';
import type TableBodyCell from './cell';
import type TableRow from './row';
import type TableInner from './table';
import diff from 'fast-diff';
import { fromEvent } from 'rxjs';
import { diffToTextOp } from '../../../utils';
import logger from '../../../utils/logger';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('table:');

class Table extends Parent {
    override children: LinkedList<TableInner> = new LinkedList();

    static override blockName = 'table';

    static create(muya: Muya, state: ITableState) {
        const table = new Table(muya);

        table.append(ScrollPage.loadBlock('table.inner').create(muya, state));

        return table;
    }

    // static createWithRowAndColumn(muya, row, column) {
    //   // TODO
    // }

    static createWithHeader(muya: Muya, header: string[]) {
        const state: ITableState = {
            name: 'table',
            children: [
                {
                    name: 'table.row',
                    children: header.map(c => ({
                        name: 'table.cell',
                        meta: { align: 'none' },
                        text: c,
                    })),
                },
                {
                    name: 'table.row',
                    children: header.map(() => ({
                        name: 'table.cell',
                        meta: { align: 'none' },
                        text: '',
                    })),
                },
            ],
        };

        return this.create(muya, state);
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    get rowCount() {
        return (this.firstChild as TableInner).length();
    }

    get columnCount() {
        return ((this.firstChild as TableInner).firstChild as TableRow).length();
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'figure';

        this.classList = ['mu-table'];
        this.createDomNode();
        this._listenDomEvent();
    }

    isEmpty() {
        const state = this.getState();

        return state.children.every(row =>
            row.children.every(cell => cell.text === ''),
        );
    }

    private _listenDomEvent() {
        const { domNode } = this;

        // Fix: prevent cursor present at the end of table.
        const mousedownHandler = (event: Event) => {
            if (event.target === domNode) {
                event.preventDefault();
                const cursorBlock = this.lastContentInDescendant()!;
                const offset = cursorBlock.text.length;
                cursorBlock.setCursor(offset, offset, true);
            }
        };

        const mousedownObservable = fromEvent(domNode!, 'mousedown');
        mousedownObservable.subscribe(mousedownHandler);
    }

    queryBlock(path: TBlockPath) {
        // Table's only child at runtime is `TableInner` (the body wrapper),
        // which extends the queryBlock mixin and is always present.
        return (this.firstChild as Parent & { queryBlock: (p: TBlockPath) => Parent | Content | undefined }).queryBlock(path);
    }

    override empty() {
        if (this.isEmpty())
            return;

        const table = this.children.head;
        if (table == null)
            return;

        table.forEach((row) => {
            (row as TableRow).forEach((cell) => {
                ((cell as TableBodyCell).firstChild as TableCellContent).text = '';
            });
        });
    }

    insertRow(offset: number) {
        const { columnCount } = this;
        const firstRowState = this.getState().children[0];
        const currentRow
            = offset > 0
                ? (this.firstChild as TableInner).find(offset - 1)
                : (this.firstChild as TableInner).find(offset);
        const state = {
            name: 'table.row',
            // eslint-disable-next-line unicorn/no-new-array
            children: [...new Array(columnCount)].map((_, i) => {
                return {
                    name: 'table.cell',
                    meta: {
                        align: firstRowState.children[i].meta.align,
                    },
                    text: '',
                };
            }),
        };

        const rowBlock = ScrollPage.loadBlock('table.row').create(this.muya, state);

        if (offset > 0)
            (this.firstChild as TableInner).insertAfter(rowBlock, currentRow as TableRow);
        else
            (this.firstChild as TableInner).insertBefore(rowBlock, currentRow as TableRow);

        return rowBlock.firstContentInDescendant();
    }

    insertColumn(offset: number, align = 'none') {
        const tableInner = this.firstChild as TableInner;
        let firstCellInNewColumn: Nullable<TableBodyCell> = null;

        tableInner.forEach((row) => {
            const state = {
                name: 'table.cell',
                meta: { align },
                text: '',
            };
            const cell = ScrollPage.loadBlock('table.cell').create(this.muya, state);
            const ref = (row as TableRow).find(offset);

            (row as TableRow).insertBefore(cell, ref as TableBodyCell);
            if (!firstCellInNewColumn)
                firstCellInNewColumn = cell;
        });

        return firstCellInNewColumn!.firstChild as TableCellContent;
    }

    removeRow(offset: number): Nullable<Content> {
        const inner = this.firstChild as TableInner;
        const row = inner.find(offset);
        if (row == null)
            return;

        // Marktext 6293d408 (#572) backport: capture a surviving neighbour
        // BEFORE the detach so the caller can place the caret on a cell that
        // is still attached to the DOM. Prefer the next row, fall back to the
        // previous; if no rows remain after this delete, capture a content
        // block OUTSIDE the table so the caret never lands inside the
        // about-to-be-detached table itself.
        const survivor = (row.next as TableRow | null) ?? (row.prev as TableRow | null);
        // Always grab the outside-of-table fallback as well, in case the
        // whole table is going away. `nextContentInContext` / `prev` walk
        // out of the table by design.
        const outsideContent
            = this.nextContentInContext() ?? this.previousContentInContext();

        row.remove();

        if (survivor == null) {
            this.remove();
            return outsideContent ?? null;
        }

        return (survivor.firstChild as TableBodyCell).firstChild as TableCellContent;
    }

    removeColumn(offset: number): Nullable<Content> {
        const { columnCount } = this;
        if (offset < 0 || offset >= columnCount) {
            debug.warn(`column at ${offset} is not existed.`);
            return;
        }

        const table = this.firstChild as TableInner;
        if (this.columnCount === 1) {
            // Same outside-of-table fallback as removeRow when the whole
            // table is removed — never leave the caret inside a detached
            // subtree.
            const outsideContent
                = this.nextContentInContext() ?? this.previousContentInContext();
            this.remove();
            return outsideContent ?? null;
        }

        // Capture the first row's surviving neighbour cell before mutation so
        // the caller can setCursor on a still-attached cell after the column
        // detach. Same intent as marktext 6293d408 — but applied per column
        // since the new architecture removes one cell per row in a loop.
        const firstRow = table.firstChild as TableRow;
        const targetCellInFirstRow = firstRow.find(offset) as TableBodyCell | null;
        const neighbourCell
            = (targetCellInFirstRow?.next as TableBodyCell | null)
                ?? (targetCellInFirstRow?.prev as TableBodyCell | null);

        table.forEach((row) => {
            const cell = (row as TableRow).find(offset);
            if (cell)
                cell.remove();
        });

        return (neighbourCell?.firstChild as TableCellContent | undefined) ?? null;
    }

    alignColumn(offset: number, value: string) {
        const { columnCount } = this;
        if (offset < 0 || offset >= columnCount) {
            debug.warn(`Column at ${offset} is not existed.`);
            return;
        }

        const table = this.firstChild as TableInner;
        table.forEach((row) => {
            const cell = (row as TableRow).find(offset) as TableBodyCell;
            if (cell) {
                const { align: oldValue } = cell;
                cell.align = oldValue === value ? 'none' : value;
                // dispatch change to modify json state
                const diffs = diff(oldValue, cell.align);
                const { path } = cell;
                path.push('meta', 'align');

                this.jsonState.editOperation(path, diffToTextOp(diffs));
            }
        });
    }

    /**
     * Resolve a body cell by its (row, column) offsets, both zero-based. Returns
     * `null` when either index is out of range. Used by the cross-cell selection
     * controller to walk the rectangle between an anchor and focus cell.
     */
    cellAt(row: number, column: number): Nullable<TableBodyCell> {
        const rowBlock = (this.firstChild as TableInner).find(row) as TableRow | undefined;
        if (rowBlock == null)
            return null;

        return (rowBlock.find(column) as TableBodyCell | undefined) ?? null;
    }

    /**
     * Build an `ITableState` for the rectangular block of cells bounded by
     * (`startRow`, `startColumn`) and (`endRow`, `endColumn`) inclusive. The
     * bounds may be passed in any order — they are normalised — and are clamped
     * to the table's dimensions. Mirrors legacy `tableSelectCellsCtrl`'s
     * sub-table extraction so a copied cell rectangle round-trips to GFM table
     * markdown via `StateToMarkdown`. The first selected row becomes the header
     * row of the resulting sub-table, preserving each cell's alignment.
     */
    getSubTableState(
        startRow: number,
        startColumn: number,
        endRow: number,
        endColumn: number,
    ): ITableState {
        const { rowCount, columnCount } = this;
        const minRow = Math.max(0, Math.min(startRow, endRow));
        const maxRow = Math.min(rowCount - 1, Math.max(startRow, endRow));
        const minColumn = Math.max(0, Math.min(startColumn, endColumn));
        const maxColumn = Math.min(columnCount - 1, Math.max(startColumn, endColumn));

        const children: ITableState['children'] = [];
        for (let r = minRow; r <= maxRow; r++) {
            const cells: ITableRowState['children'] = [];
            for (let c = minColumn; c <= maxColumn; c++) {
                const cell = this.cellAt(r, c);
                if (cell)
                    cells.push(cell.getState());
            }
            children.push({ name: 'table.row', children: cells });
        }

        return { name: 'table', children };
    }

    override getState(): ITableState {
        return (this.firstChild as TableInner).getState();
    }
}

export default Table;
