import type TableBodyCell from '../block/gfm/table/cell';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, IImageSelectionData, ISelection } from './types';
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

    constructor(private _muya: Muya) {
        this._text = new TextSelection(this._muya, this);
        this._image = new ImageSelection(this._muya, this);
        this._image.attach();
        this._table = TableRectSelection.create(this._muya);
    }

    get type(): SelectionType {
        if (this._image.selected)
            return SelectionType.IMAGE;
        if (this._table.hasSelection)
            return SelectionType.TABLE;
        return SelectionType.TEXT;
    }

    get current(): TextSelection | TableRectSelection | ImageSelection {
        switch (this.type) {
            case SelectionType.IMAGE: return this._image;
            case SelectionType.TABLE: return this._table;
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

    /**
     * Select an image by selecting the text its `![…](…)` source occupies, so
     * the editor keeps a real selection while the image is "the selection".
     *
     * Dropping the selection instead (what `activate(IMAGE)` does for the other
     * non-text kinds) left the editor focused with nowhere for an edit to land:
     * the browser aimed the next key at the start of the first block, where it
     * corrupted the view without reaching the document (#5390), and muya's own
     * key dispatch followed the stray range there too (#5395, #5396). With the
     * source range selected, typing replaces the image and Backspace deletes it
     * because that is what those keys do to any selection.
     */
    selectImage(data: IImageSelectionData): void {
        const { block, token } = data;

        this._image.selected = data;
        this._table.clear();
        this._text.setSelection(
            { offset: token.range.start, block, path: block.path },
            { offset: token.range.end, block, path: block.path },
        );
        // Last, so a listener that reads the kind sees `image` rather than the
        // text selection the line above announced.
        this._muya.eventCenter.emit('selection-change', {
            kind: SelectionType.IMAGE,
        });
    }

    activate(type: SelectionType): void {
        if (type !== SelectionType.TEXT)
            this._text.collapse();
        if (type !== SelectionType.TABLE)
            this._table.clear();
        if (type !== SelectionType.IMAGE)
            this._image.clear();

        if (type !== SelectionType.TEXT) {
            this._muya.eventCenter.emit('selection-change', {
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

    /**
     * The source text of the current text selection. Empty for a caret, and for
     * table and image selections: a table selection drops the native range this
     * reads, and a selected image, though it spans its `![…](…)` source, is an
     * object the reader picked out rather than text — the desktop shell counts
     * this for its selected-word display.
     */
    getSelectedText(): string {
        if (this._image.selected)
            return '';

        return this._text.getSelectedText();
    }

    setSelection(anchor: IAnchorFocusInfo, focus: IAnchorFocusInfo): void {
        this._text.setSelection(anchor, focus);
    }

    selectAll(): void {
        const tableSelection = this._table;

        // A frozen rectangular table selection escalates: the whole table jumps
        // to the whole document; any partial rectangle (a single cell included)
        // grows to the whole table first.
        if (tableSelection.hasSelection) {
            if (tableSelection.isWholeTableSelected()) {
                tableSelection.clear();
                this._text.selectAllContent();
            }
            else {
                tableSelection.selectWholeTable();
            }
            return;
        }

        // Read the live DOM selection so the caret the user actually sees is
        // honored. selectAll is driven from the application menu, so the cached
        // endpoints may be stale — e.g. after a whole-document selection blurred
        // the editor and the user clicked back into a single block.
        const live = this.getSelection();
        const anchorBlock = live ? live.anchor.block : this._text.anchorBlock;
        const focusBlock = live ? live.focus.block : this._text.focusBlock;
        const anchorOffset = live ? live.anchor.offset : this._text.anchor?.offset;
        const focusOffset = live ? live.focus.offset : this._text.focus?.offset;

        // A caret or selection contained in a single content block. The cached
        // block can be one that undo removed from the document, since undoing
        // the first edit restores no caret (#5387).
        if (anchorBlock?.outMostBlock && anchorBlock === focusBlock && anchorOffset != null && focusOffset != null) {
            // Inside one table cell: freeze it as a 1x1 rectangle.
            if (anchorBlock.blockName === 'table.cell.content') {
                const cellBlock = anchorBlock.closestBlock('table.cell') as TableBodyCell | null;
                if (cellBlock) {
                    tableSelection.selectSingleCell(cellBlock);
                    return;
                }
            }

            // A partial selection grows to the whole block; a full-block
            // selection falls through to the whole document.
            if (Math.abs(focusOffset - anchorOffset) < anchorBlock.text.length) {
                const path = anchorBlock.path;
                this._text.setSelection(
                    { offset: 0, block: anchorBlock, path },
                    { offset: anchorBlock.text.length, block: anchorBlock, path },
                );
                return;
            }
        }

        // Spanning multiple blocks, or a single block already fully selected.
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
