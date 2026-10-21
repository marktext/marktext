import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Muya } from '../muya';
import type { ITableState } from '../state/types';
import type { Nullable } from '../types';
import { CLASS_NAMES } from '../config';
import { isMouseEvent } from '../utils';
import { getBlock } from '../utils/dom';

const SELECTED_CLASS = CLASS_NAMES.MU_TABLE_CELL_SELECTED;
const BORDER_TOP_CLASS = CLASS_NAMES.MU_TABLE_CELL_BORDER_TOP;
const BORDER_RIGHT_CLASS = CLASS_NAMES.MU_TABLE_CELL_BORDER_RIGHT;
const BORDER_BOTTOM_CLASS = CLASS_NAMES.MU_TABLE_CELL_BORDER_BOTTOM;
const BORDER_LEFT_CLASS = CLASS_NAMES.MU_TABLE_CELL_BORDER_LEFT;

interface ICellPosition {
    cell: TableBodyCell;
    row: number;
    column: number;
}

class TableRectSelection {
    private _table: Nullable<Table> = null;
    private _anchor: Nullable<ICellPosition> = null;
    private _focus: Nullable<ICellPosition> = null;
    private _isSelecting = false;
    private _dragEventIds: string[] = [];

    static create(muya: Muya): TableRectSelection {
        const instance = new TableRectSelection(muya);
        instance._attach();

        return instance;
    }

    constructor(private _muya: Muya) {}

    get hasSelection(): boolean {
        return this._table != null && this._anchor != null && this._focus != null;
    }

    isSingleCellSelected(): boolean {
        return this.hasSelection && this._anchor!.cell === this._focus!.cell;
    }

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
        this._freezeNativeSelection();
        this._renderHighlight();
    }

    selectWholeTable(): void {
        const table = this._table;
        if (table)
            this.selectTable(table);
    }

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
        this._freezeNativeSelection();
        this._renderHighlight();
    }

    private _attach(): void {
        const { eventCenter, domNode } = this._muya;
        eventCenter.attachDOMEvent(domNode, 'mousedown', this._onMouseDown);
    }

    private _onMouseDown = (event: Event): void => {
        if (this._muya.isReadOnly)
            return;
        if (!isMouseEvent(event) || event.button === 2)
            return;

        // A fresh interaction exits the frozen rectangle so caret editing can resume.
        this.clear();

        const position = this._cellPositionFromEvent(event);
        if (position == null)
            return;

        this._table = position.cell.table;
        this._anchor = position;
        this._focus = position;
        this._isSelecting = false;

        const { eventCenter } = this._muya;
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
            this._freezeNativeSelection();
        }

        if (!this._isSelecting)
            return;

        this._suppressNativeRange();

        // Off-table moves null the focus, so releasing outside the table
        // cancels the selection rather than freezing a 1×1 anchor-cell range.
        this._focus = overSameTable ? position : null;
        this._renderHighlight();
    };

    private _onMouseUp = (): void => {
        this._detachDragEvents();

        if (!this._isSelecting || this._focus == null)
            this.clear();
    };

    private _freezeNativeSelection(): void {
        document.getSelection()?.removeAllRanges();
        this._muya.domNode.focus();
        this._muya.editor.activeContentBlock = null;
        this._muya.ui.hideAllFloatTools();
    }

    private _suppressNativeRange(): void {
        document.getSelection()?.removeAllRanges();
    }

    private _detachDragEvents(): void {
        const { eventCenter } = this._muya;
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
                const classList = this._table.cellAt(r, c)?.domNode?.classList;
                if (classList == null)
                    continue;

                classList.add(SELECTED_CLASS);
                if (r === minRow)
                    classList.add(BORDER_TOP_CLASS);
                if (c === maxColumn)
                    classList.add(BORDER_RIGHT_CLASS);
                if (r === maxRow)
                    classList.add(BORDER_BOTTOM_CLASS);
                if (c === minColumn)
                    classList.add(BORDER_LEFT_CLASS);
            }
        }
    }

    private _clearHighlight(): void {
        const dom = this._table?.domNode;
        if (dom == null)
            return;

        for (const cell of dom.querySelectorAll(`.${SELECTED_CLASS}`)) {
            cell.classList.remove(
                SELECTED_CLASS,
                BORDER_TOP_CLASS,
                BORDER_RIGHT_CLASS,
                BORDER_BOTTOM_CLASS,
                BORDER_LEFT_CLASS,
            );
        }
    }

    // Selected sub-table, or null without a frozen selection.
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

    // Clear text while keeping the rectangle selected. Return whether any cell changed
    // so keyboard deletion can remove structure only on a subsequent press.
    emptySelectedCells(): boolean {
        if (!this.hasSelection)
            return false;

        const minRow = Math.min(this._anchor!.row, this._focus!.row);
        const maxRow = Math.max(this._anchor!.row, this._focus!.row);
        const minColumn = Math.min(this._anchor!.column, this._focus!.column);
        const maxColumn = Math.max(this._anchor!.column, this._focus!.column);

        let hadContent = false;
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColumn; c <= maxColumn; c++) {
                const content = this._table!.cellAt(r, c)?.firstChild;
                if (content && content.isContent() && content.text !== '') {
                    hadContent = true;
                    content.text = '';
                    // The text setter does not refresh non-anchor cells' DOM.
                    content.update();
                }
            }
        }

        return hadContent;
    }

    clearSelectedCells(): void {
        if (!this.hasSelection)
            return;

        const anchorContent = this._anchor!.cell.firstChild;
        this.emptySelectedCells();
        this.clear();
        if (anchorContent && anchorContent.isContent())
            anchorContent.setCursor(0, 0, true);
    }

    clear(): void {
        this._clearHighlight();
        this._table = null;
        this._anchor = null;
        this._focus = null;
        this._isSelecting = false;
    }
}

export default TableRectSelection;
