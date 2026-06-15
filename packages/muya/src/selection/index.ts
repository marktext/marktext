import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Muya } from '../muya';
import type { ICursor, IImageSelectionData, ISelection } from './types';
import {
    getCursorCoords,
    getCursorYOffset,
    getSelectionStart,
} from './cursorCoords';
import ImageSelection from './ImageSelection';
import TableRectSelection from './TableRectSelection';
import TextSelection from './TextSelection';
import { SelectionType } from './types';

class Selection {
    static getCursorYOffset(paragraph: HTMLElement) {
        return getCursorYOffset(paragraph);
    }

    static getCursorCoords(preferEnd = false) {
        return getCursorCoords(preferEnd);
    }

    static getSelectionStart() {
        return getSelectionStart();
    }

    private _text: TextSelection;
    private _image: ImageSelection;
    private _table: TableRectSelection;

    constructor(public muya: Muya) {
        this._text = new TextSelection(muya, this);
        this._image = new ImageSelection(muya, this);
        this._image.attach();
        this._table = TableRectSelection.create(muya);
    }

    get type(): SelectionType {
        if (this._image.selected)
            return SelectionType.Image;
        if (this._table.hasSelection)
            return SelectionType.Table;
        return SelectionType.Text;
    }

    get current(): TextSelection | TableRectSelection | ImageSelection {
        switch (this.type) {
            case SelectionType.Image: return this._image;
            case SelectionType.Table: return this._table;
            default: return this._text;
        }
    }

    get image(): IImageSelectionData | null {
        return this._image.selected;
    }

    get table(): TableRectSelection {
        return this._table;
    }

    get anchorBlock() {
        return this._text.anchorBlock;
    }

    get anchorPath() {
        return this._text.anchorPath;
    }

    get focusBlock() {
        return this._text.focusBlock;
    }

    get focusPath() {
        return this._text.focusPath;
    }

    get anchor() {
        return this._text.anchor;
    }

    get focus() {
        return this._text.focus;
    }

    get isSelectionInSameBlock() {
        return this._text.isSelectionInSameBlock;
    }

    selectImage(data: IImageSelectionData): void {
        this._image.selected = data;
        this.muya.editor.activeContentBlock = null;
        this.activate(SelectionType.Image);
    }

    activate(type: SelectionType): void {
        if (type !== SelectionType.Text)
            this._text.collapse();
        if (type !== SelectionType.Table)
            this._table.clear();
        if (type !== SelectionType.Image)
            this._image.clear();

        if (type !== SelectionType.Text) {
            this.muya.eventCenter.emit('selection-change', {
                kind: type,
            });
        }
    }

    clear(): void {
        this._text.collapse();
        this._table.clear();
        this._image.clear();
    }

    clearImage(): void {
        this._image.clear();
    }

    getSelection(): ISelection | null {
        return this._text.getSelection();
    }

    setSelection(cursor: ICursor): void {
        this._text.setSelection(cursor);
    }

    selectAll(): void {
        const { anchor, focus, isSelectionInSameBlock, anchorBlock, focusBlock, anchorPath } = this._text;
        const tableSelection = this._table;

        if (tableSelection.isWholeTableSelected()) {
            tableSelection.clear();
            this._text.selectAllContent();
            return;
        }

        if (tableSelection.isSingleCellSelected()) {
            const cellBlock = anchorBlock?.closestBlock('table.cell') as TableBodyCell | null;
            const table = cellBlock?.table ?? null;

            if (table) {
                tableSelection.selectTable(table);
                return;
            }
        }

        if (
            anchorBlock?.blockName === 'table.cell.content'
            && focusBlock?.blockName === 'table.cell.content'
        ) {
            const anchorTable = anchorBlock.closestBlock('table') as Table | null;
            const focusTable = focusBlock.closestBlock('table') as Table | null;
            if (anchorBlock === focusBlock) {
                const cellBlock = anchorBlock.closestBlock('table.cell') as TableBodyCell | null;
                if (cellBlock) {
                    tableSelection.selectSingleCell(cellBlock);
                    return;
                }
            }
            else if (anchorTable && focusTable && anchorTable === focusTable) {
                tableSelection.selectTable(anchorTable);
                return;
            }
            else {
                return;
            }
        }

        // Code content and the fenced language input clamp inside their own
        // block and stay idempotent on repeated Cmd+A — never escalate to the
        // whole document.
        if (
            anchorBlock
            && (anchorBlock.blockName === 'codeblock.content'
                || anchorBlock.blockName === 'language-input')
        ) {
            this._text.setSelection({
                anchor: { offset: 0 },
                focus: { offset: anchorBlock.text.length },
                block: anchorBlock,
                path: anchorPath,
            });
            return;
        }
        if (
            isSelectionInSameBlock
            && anchor
            && focus
            && anchorBlock
            && Math.abs(focus.offset - anchor.offset) < anchorBlock.text.length
        ) {
            this._text.setSelection({
                anchor: { offset: 0 },
                focus: { offset: anchorBlock.text.length },
                block: anchorBlock,
                path: anchorPath,
            });
            return;
        }

        this._text.selectAllContent();
    }
}

export function getCursorReference() {
    const rect = getCursorCoords();

    if (!rect)
        return null;

    return {
        getBoundingClientRect() {
            return rect;
        },
        clientWidth: rect.width,
        clientHeight: rect.height,
    };
}

export default Selection;
