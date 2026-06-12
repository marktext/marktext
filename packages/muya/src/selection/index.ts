import type { Muya } from '../muya';
import type { ICursor, IImageSelectionData, ISelection, SelectionType } from './types';
import {
    getCursorCoords,
    getCursorYOffset,
    getSelectionStart,
} from './cursorCoords';
import ImageSelection from './ImageSelection';
import TableRectSelection from './TableRectSelection';
import TextSelection from './TextSelection';

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
            return 'image';
        if (this._table.hasSelection)
            return 'table';
        return 'text';
    }

    get current(): TextSelection | TableRectSelection | ImageSelection {
        switch (this.type) {
            case 'image': return this._image;
            case 'table': return this._table;
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
        this.activate('image');
    }

    activate(type: SelectionType): void {
        if (type !== 'text')
            this._text.collapse();
        if (type !== 'table')
            this._table.clear();
        if (type !== 'image')
            this._image.clear();

        if (type !== 'text') {
            this.muya.eventCenter.emit('selection-change', {
                kind: type,
                selection: this.current,
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
        this._text.selectAll();
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
