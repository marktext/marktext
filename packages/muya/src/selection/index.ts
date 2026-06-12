import type { Muya } from '../muya';
import type TableRectSelection from './TableRectSelection';
import type { ICursor, IImageSelectionData, ISelection, SelectionType } from './types';
import {
    getCursorCoords,
    getCursorYOffset,
    getSelectionStart,
} from './cursorCoords';
import ImageSelection from './ImageSelection';
import TextSelection from './TextSelection';

class Selection {
    /**
     * topOffset is the line counts above cursor, and bottomOffset is line counts bellow cursor.
     * @param {*} paragraph
     */
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
    private _activeType: SelectionType = 'text';

    constructor(public muya: Muya) {
        this._text = new TextSelection(muya, this);
        this._image = new ImageSelection(muya, this);
        this._image.attach();
    }

    get type(): SelectionType {
        return this._activeType;
    }

    get current(): TextSelection | TableRectSelection | ImageSelection {
        switch (this._activeType) {
            case 'table': return this.table!;
            case 'image': return this._image;
            default: return this._text;
        }
    }

    get image(): IImageSelectionData | null {
        return this._image.selected;
    }

    get table(): TableRectSelection | null {
        return this.muya.editor?.tableSelection ?? null;
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

    get selectedImage() {
        return this._image.selected;
    }

    set selectedImage(value: IImageSelectionData | null) {
        this._image.selected = value;
    }

    activate(type: SelectionType): void {
        if (type !== 'text')
            this._text.collapse();
        if (type !== 'table')
            this.table?.clear();
        if (type !== 'image')
            this._image.clear();
        this._activeType = type;

        if (type !== 'text') {
            this.muya.eventCenter.emit('selection-change', {
                kind: type,
                selection: this.current,
            });
        }
    }

    clear(): void {
        this._text.collapse();
        this.table?.clear();
        this._image.clear();
        this._activeType = 'text';
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
