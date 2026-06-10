import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Muya } from '../muya';
import type { ITableState } from '../state/types';
import type { Nullable } from '../types';
import { isMouseEvent } from '../utils';
import { getBlock } from '../utils/dom';

// Port of marktext `src/muya/lib/contentState/tableSelectCellsCtrl.js`. The
// legacy engine let the user drag a rectangle of table cells and copy/cut just
// that sub-range (rather than the whole table). The TS rewrite shipped without
// it (Phase G regression); this module restores it.
//
// Flow, mirroring the legacy controller:
//   - mousedown on a cell        → record the anchor cell, arm a drag.
//   - mousemove over a same-table cell other than the anchor → start the
//     selection, collapse the caret into the anchor cell, highlight the
//     anchor→focus rectangle. Moving off the table nulls the focus.
//   - mouseup                    → freeze the selection so copy/cut can read it,
//     unless the focus is null (released outside the table → cancelled).
//
// The selected rectangle is exposed as an `ITableState` (`getStateForCopy`) so
// the clipboard serialises it to GFM markdown via `StateToMarkdown`, and
// `clearSelectedCells` empties the cells in place for cut. A fresh caret
// (mousedown inside a cell, click elsewhere) clears the selection.
//
// Cleanup: every listener is attached via `eventCenter.attachDOMEvent`, so
// `muya.destroy()` → `eventCenter.detachAllDomEvents()` removes the editor-level
// handlers; the transient document-level drag handlers are detached on mouseup.

const SELECTED_CLASS = 'mu-table-cell-selected';

interface ICellPosition {
    cell: TableBodyCell;
    row: number;
    column: number;
}

class TableCellSelection {
    private _table: Nullable<Table> = null;
    private _anchor: Nullable<ICellPosition> = null;
    private _focus: Nullable<ICellPosition> = null;
    private _isSelecting = false;
    private _dragEventIds: string[] = [];

    static create(muya: Muya): TableCellSelection {
        const instance = new TableCellSelection(muya);
        instance.attach();

        return instance;
    }

    constructor(public muya: Muya) {}

    /** True while a multi-cell rectangle is frozen and available to copy/cut. */
    get hasSelection(): boolean {
        return this._table != null && this._anchor != null && this._focus != null;
    }

    /**
     * Whether the frozen selection covers exactly one cell. Mirrors legacy
     * `tableSelectCellsCtrl.isSingleCellSelected` (cells.length === 1).
     */
    isSingleCellSelected(): boolean {
        return this.hasSelection && this._anchor!.cell === this._focus!.cell;
    }

    /**
     * Whether the frozen selection covers every cell in the table. Mirrors
     * legacy `tableSelectCellsCtrl.isWholeTableSelected` (cells.length ===
     * (row + 1) * (column + 1)).
     */
    isWholeTableSelected(): boolean {
        if (!this.hasSelection)
            return false;

        const minRow = Math.min(this._anchor!.row, this._focus!.row);
        const maxRow = Math.max(this._anchor!.row, this._focus!.row);
        const minColumn = Math.min(this._anchor!.column, this._focus!.column);
        const maxColumn = Math.max(this._anchor!.column, this._focus!.column);

        return (
            minRow === 0
            && minColumn === 0
            && maxRow === this._table!.rowCount - 1
            && maxColumn === this._table!.columnCount - 1
        );
    }

    /**
     * Freeze a whole-table selection (anchor at the top-left cell, focus at the
     * bottom-right cell) and highlight every cell. Mirrors legacy
     * `tableSelectCellsCtrl.selectTable`.
     */
    selectTable(table: Table): void {
        this.clear();

        const anchorCell = table.cellAt(0, 0);
        const focusCell = table.cellAt(table.rowCount - 1, table.columnCount - 1);
        if (anchorCell == null || focusCell == null)
            return;

        this._table = table;
        this._anchor = {
            cell: anchorCell,
            row: anchorCell.rowOffset,
            column: anchorCell.columnOffset,
        };
        this._focus = {
            cell: focusCell,
            row: focusCell.rowOffset,
            column: focusCell.columnOffset,
        };
        this._isSelecting = true;
        this._collapseCaretToAnchor();
        this._renderHighlight();
    }

    /**
     * Freeze a single 1x1 cell selection on the given cell. Mirrors the legacy
     * `selectAll` single-cell branch (`selectedTableCells` of length 1).
     */
    selectSingleCell(cell: TableBodyCell): void {
        this.clear();

        this._table = cell.table;
        const position: ICellPosition = {
            cell,
            row: cell.rowOffset,
            column: cell.columnOffset,
        };
        this._anchor = position;
        this._focus = position;
        this._isSelecting = true;
        this._collapseCaretToAnchor();
        this._renderHighlight();
    }

    attach(): void {
        const { eventCenter, domNode } = this.muya;
        eventCenter.attachDOMEvent(domNode, 'mousedown', this._onMouseDown);
    }

    private _onMouseDown = (event: Event): void => {
        // Right-click opens the context menu; never start a drag-select then.
        if (!isMouseEvent(event) || event.button === 2)
            return;

        // Any fresh interaction discards a previous frozen selection so a normal
        // caret click inside a cell behaves like plain editing again.
        this.clear();

        const position = this._cellPositionFromEvent(event);
        if (position == null)
            return;

        this._table = position.cell.table;
        this._anchor = position;
        this._focus = position;
        this._isSelecting = false;

        const { eventCenter } = this.muya;
        this._dragEventIds.push(
            eventCenter.attachDOMEvent(document, 'mousemove', this._onMouseMove),
            eventCenter.attachDOMEvent(document, 'mouseup', this._onMouseUp),
        );
    };

    private _onMouseMove = (event: Event): void => {
        if (!isMouseEvent(event) || this._anchor == null || this._table == null)
            return;

        const position = this._cellPositionFromEvent(event);
        const overSameTable
            = position != null && position.cell.table === this._table;

        // Begin selecting only once the pointer leaves the anchor cell — within
        // a single cell the user is just placing/extending a text caret.
        if (
            overSameTable
            && position.cell !== this._anchor.cell
            && !this._isSelecting
        ) {
            this._isSelecting = true;
            // Collapse the native text range to a caret in the anchor cell so
            // the rectangle highlight is the only visible *range* selection,
            // while the editor stays focused — copy/cut events fire only on the
            // focused element, so a full blur would break the clipboard.
            this._collapseCaretToAnchor();
        }

        if (!this._isSelecting)
            return;

        // The browser keeps trying to extend a native text selection during the
        // drag; collapse it again each move so only the cell rectangle shows.
        this._collapseCaretToAnchor();

        // Off-table moves null the focus (legacy `tableSelectCellsCtrl` sets
        // `focus = null`), so releasing outside the table cancels the selection
        // rather than freezing a 1×1 anchor-cell range.
        this._focus = overSameTable ? position : null;
        this._renderHighlight();
    };

    private _onMouseUp = (): void => {
        this._detachDragEvents();

        // Nothing to freeze when the drag never started (a plain click) or the
        // pointer was released outside the table (focus is null) — legacy
        // `handleCellMouseUp` bails on a null focus too.
        if (!this._isSelecting || this._focus == null)
            this.clear();
    };

    /**
     * Collapse the live native selection to a caret at the start of the anchor
     * cell's content. Keeps the editor focused (so the clipboard `copy`/`cut`
     * events still fire) while removing the blue text highlight that would
     * otherwise compete with the cell rectangle.
     */
    private _collapseCaretToAnchor(): void {
        const content = this._anchor?.cell.firstChild;
        if (content && content.isContent())
            content.setCursor(0, 0, false);

        this.muya.ui.hideAllFloatTools();
    }

    private _detachDragEvents(): void {
        const { eventCenter } = this.muya;
        for (const id of this._dragEventIds)
            eventCenter.detachDOMEvent(id);

        this._dragEventIds = [];
    }

    private _cellPositionFromEvent(event: MouseEvent): Nullable<ICellPosition> {
        const { target } = event;
        if (!(target instanceof Element))
            return null;

        const cellDom = target.closest('td.mu-table-cell');
        if (cellDom == null)
            return null;

        const block = getBlock(cellDom);
        if (block == null || block.blockName !== 'table.cell')
            return null;

        const cell = block as TableBodyCell;

        return {
            cell,
            row: cell.rowOffset,
            column: cell.columnOffset,
        };
    }

    /** Apply the selection class to every cell inside the anchor→focus rectangle. */
    private _renderHighlight(): void {
        this._clearHighlight();
        if (this._table == null || this._anchor == null || this._focus == null)
            return;

        const minRow = Math.min(this._anchor.row, this._focus.row);
        const maxRow = Math.max(this._anchor.row, this._focus.row);
        const minColumn = Math.min(this._anchor.column, this._focus.column);
        const maxColumn = Math.max(this._anchor.column, this._focus.column);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColumn; c <= maxColumn; c++) {
                const cell = this._table.cellAt(r, c);
                cell?.domNode?.classList.add(SELECTED_CLASS);
            }
        }
    }

    private _clearHighlight(): void {
        const dom = this._table?.domNode;
        if (dom == null)
            return;

        for (const cell of dom.querySelectorAll(`.${SELECTED_CLASS}`))
            cell.classList.remove(SELECTED_CLASS);
    }

    /**
     * The selected rectangle as an `ITableState` sub-table, or `null` when there
     * is no frozen selection. The clipboard serialises this to GFM markdown.
     */
    getStateForCopy(): Nullable<ITableState> {
        if (!this.hasSelection)
            return null;

        return this._table!.getSubTableState(
            this._anchor!.row,
            this._anchor!.column,
            this._focus!.row,
            this._focus!.column,
        );
    }

    /**
     * Empty every selected cell's text in place (cut). Routed through the
     * content block's `text` setter so each edit dispatches a json op and the
     * document state stays in sync. The caret is placed in the anchor cell.
     */
    clearSelectedCells(): void {
        if (!this.hasSelection)
            return;

        const minRow = Math.min(this._anchor!.row, this._focus!.row);
        const maxRow = Math.max(this._anchor!.row, this._focus!.row);
        const minColumn = Math.min(this._anchor!.column, this._focus!.column);
        const maxColumn = Math.max(this._anchor!.column, this._focus!.column);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColumn; c <= maxColumn; c++) {
                const content = this._table!.cellAt(r, c)?.firstChild;
                if (content && content.isContent() && content.text !== '')
                    content.text = '';
            }
        }

        const anchorContent = this._anchor!.cell.firstChild;
        this.clear();
        if (anchorContent && anchorContent.isContent())
            anchorContent.setCursor(0, 0, true);
    }

    /** Discard the frozen selection and remove every highlight class. */
    clear(): void {
        this._clearHighlight();
        this._table = null;
        this._anchor = null;
        this._focus = null;
        this._isSelecting = false;
    }
}

export default TableCellSelection;
