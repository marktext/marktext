import type Format from '../block/base/format';
import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Muya } from '../muya';
import type { IImageInfo } from '../utils/image';
import type {
    IImageSelection,
    IResolvedTextSelection,
    ITableRectSelection,
    ITableRectSelectionState,
    ITextSelection,
    TSelection,
    TSelectionCoords,
    TSelectionState,
} from './types';
import { CLASS_NAMES } from '../config';
import { getImageInfo } from '../utils/image';
import { buildAffiliation, buildSelectionAffiliation, endpointBlockInfo } from './affiliation';
import { getCursorCoords, getCursorYOffset, getSelectionStart } from './cursorCoords';
import { getOffsetOfParagraph } from './dom';
import ImageSelection from './ImageSelection';
import {
    contentPath,
    copySelectionState,
    createTextSelectionState,
    isLegalOffset,
    isSelectionState,
    resolveContent,
    resolveEndpoint,
} from './state';
import TableRectSelection from './TableRectSelection';
import TextSelection from './TextSelection';
import { SelectionDirection, SelectionType } from './types';

function comparePaths(a: readonly (string | number)[], b: readonly (string | number)[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i])
            continue;
        return typeof a[i] === 'number' && typeof b[i] === 'number'
            ? Number(a[i]) - Number(b[i])
            : String(a[i]).localeCompare(String(b[i]));
    }
    return a.length - b.length;
}

class Selection {
    static getCursorYOffset = getCursorYOffset;
    static getCursorCoords = getCursorCoords;
    static getSelectionStart = getSelectionStart;

    private _text: TextSelection;
    private _image: ImageSelection;
    private _table: TableRectSelection;
    private _state: TSelectionState | null = null;
    private _setting = false;
    private _frame: number | null = null;
    private _docChanged = false;
    private _lastPublished = '';

    constructor(private _muya: Muya) {
        this._text = new TextSelection(_muya, this);
        this._image = new ImageSelection(_muya, this);
        this._image.attach();
        this._table = TableRectSelection.create(_muya);
        _muya.eventCenter.attachDOMEvent(document, 'selectionchange', () => this.syncTextSelection());
        _muya.eventCenter.attachDOMEvent(document, 'mouseup', () => this.flush());
    }

    get type(): SelectionType | null {
        return this._state?.kind ?? null;
    }

    get table(): TableRectSelection {
        return this._table;
    }

    get image() {
        return this.getImageSelection()?.context ?? null;
    }

    get anchorBlock() {
        return this._text.anchorBlock;
    }

    get focusBlock() {
        return this._text.focusBlock;
    }

    get anchorPath() {
        return this._text.anchorPath;
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

    private _readNative(): IResolvedTextSelection | null {
        const live = this._text.getSelection();
        if (!live)
            return null;
        const { anchor, focus } = live;
        return this._muya.isBlockInDocument(anchor.block) && this._muya.isBlockInDocument(focus.block)
            ? live
            : null;
    }

    private _cacheText(live: IResolvedTextSelection) {
        const { anchor, focus } = live;
        // Native reads refresh the public state; block handlers still need the
        // previously applied endpoints when updating inline presentation.
        this._state = createTextSelectionState(anchor, focus);
        if (this._text.anchor && this._text.focus)
            return;

        this._text.anchor = {
            offset: anchor.offset,
        };
        this._text.focus = {
            offset: focus.offset,
        };
        this._text.anchorBlock = anchor.block;
        this._text.focusBlock = focus.block;
        this._text.anchorPath = [...anchor.path];
        this._text.focusPath = [...focus.path];
    }

    getSelectionState(): TSelectionState | null {
        if (!this._setting && (!this._state || this._state.kind === SelectionType.TEXT)) {
            const live = this._readNative();
            if (live)
                this._cacheText(live);
        }
        return copySelectionState(this._state);
    }

    getSelection(): TSelection | null {
        const state = this.getSelectionState();
        const selection = state ? this._resolve(state) : null;
        return selection && this._isValid(selection) ? selection : null;
    }

    getTextSelection(): IResolvedTextSelection | null {
        const state = this.getSelectionState();
        const selection = state?.kind === SelectionType.TEXT ? this._resolveText(state, false) : null;
        if (!selection)
            return null;
        const { anchor, focus, context } = selection;
        const { anchorBlock, focusBlock, isCollapsed, isSelectionInSameBlock, direction } = context;
        return {
            anchor: {
                ...anchor,
                path: [...anchor.path],
                block: anchorBlock,
            },
            focus: {
                ...focus,
                path: [...focus.path],
                block: focusBlock,
            },
            isCollapsed,
            isSelectionInSameBlock,
            direction,
        };
    }

    getImageSelection(): IImageSelection | null {
        const selection = this.getSelection();
        return selection?.kind === SelectionType.IMAGE ? selection : null;
    }

    setSelection(state: TSelectionState | null): boolean {
        if (state !== null && !isSelectionState(state))
            return false;
        const selection = state ? this._resolve(state) : null;
        if (state && (!selection || !this._isValid(selection)))
            return false;
        this._setting = true;
        try {
            this._state = copySelectionState(state);
            this._image.clear();
            this._table.clear();
            if (selection?.kind !== SelectionType.TEXT) {
                this._muya.editor.activeContentBlock = null;
                this._text.collapse();
            }
            if (selection?.kind === SelectionType.TEXT) {
                const { anchor, focus } = selection;
                const { anchorBlock, focusBlock } = selection.context;
                this._muya.editor.activeContentBlock = anchorBlock === focusBlock ? anchorBlock : null;
                this._text.setSelection(
                    {
                        ...anchor,
                        path: [...anchor.path],
                        block: anchorBlock,
                    },
                    {
                        ...focus,
                        path: [...focus.path],
                        block: focusBlock,
                    },
                );
            }
            else {
                if (selection?.kind === SelectionType.IMAGE)
                    this._image.setSelection(this._resolveImage(selection) ?? selection);
                else if (selection?.kind === SelectionType.TABLE)
                    this._table.setSelection(selection);
            }
        }
        finally {
            this._setting = false;
        }
        this.notify();
        return true;
    }

    clear() {
        this.setSelection(null);
    }

    clearImage() {
        if (this.type === SelectionType.IMAGE)
            this.clear();
    }

    selectImage(data: IImageInfo & { block: Format }): void {
        const { block, token } = data;
        const { range, raw } = token;
        // Re-clicking a selected image must reopen tools hidden by scrolling.
        this._lastPublished = '';
        this.setSelection({
            kind: SelectionType.IMAGE,
            path: contentPath(block),
            range,
            raw,
        });
    }

    syncTextSelection() {
        // Root focus can plant a caret while the table owns the visible selection.
        if (this._setting || this._table.hasSelection || this.type === SelectionType.IMAGE)
            return;
        const live = this._readNative();
        if (!live)
            return;
        this._setting = true;
        try {
            this._cacheText(live);
            this._image.clear();
        }
        finally {
            this._setting = false;
        }
        this.notify(false, true);
    }

    syncTableSelection(state: ITableRectSelectionState | null) {
        if (this._setting || (!state && this.type !== SelectionType.TABLE))
            return;
        this._setting = true;
        try {
            this._state = copySelectionState(state);
            if (state) {
                this._text.collapse();
                this._image.clear();
            }
        }
        finally {
            this._setting = false;
        }
        this.notify(false, true);
    }

    private get _canNotify(): boolean {
        const { transactions, isUpdating, isComposing } = this._muya.editor;
        return !this._setting && !transactions.isActive && !isUpdating && !isComposing;
    }

    notify(docChanged = false, deferred = false) {
        this._docChanged ||= docChanged;
        if (!this._canNotify)
            return;
        if (deferred) {
            this._frame ??= requestAnimationFrame(() => {
                this._frame = null;
                this.flush();
            });
        }
        else {
            this.flush();
        }
    }

    flush() {
        if (!this._canNotify)
            return;
        if (this._frame !== null)
            cancelAnimationFrame(this._frame);
        this._frame = null;
        const selection = this.getSelection();
        if (!selection && this._state) {
            this._setting = true;
            try {
                this._state = null;
                this._image.clear();
                this._table.clear();
                this._muya.editor.activeContentBlock = null;
                this._text.collapse();
            }
            finally {
                this._setting = false;
            }
        }
        const formats = selection?.kind === SelectionType.TEXT
            ? selection.context.formats.map(({ type, raw }) => [type, raw])
            : [];
        const signature = JSON.stringify([copySelectionState(selection), formats]);
        const docChanged = this._docChanged;
        this._docChanged = false;
        if (!docChanged && signature === this._lastPublished)
            return;
        this._lastPublished = signature;
        this._muya.eventCenter.emit('selection-change', {
            selection,
            docChanged,
        });
    }

    cancel() {
        if (this._frame !== null)
            cancelAnimationFrame(this._frame);
        this._frame = null;
        this._docChanged = false;
        this._lastPublished = '';
    }

    private _resolve(state: TSelectionState): TSelection | null {
        switch (state.kind) {
            case SelectionType.TEXT:
                return this._resolveText(state);
            case SelectionType.IMAGE:
                return this._resolveImage(state);
            case SelectionType.TABLE:
                return this._resolveTable(state);
        }
    }

    private _resolveText(
        state: Extract<TSelectionState, { kind: SelectionType.TEXT }>,
        includeFormats = true,
    ): ITextSelection | null {
        const anchor = resolveEndpoint(this._muya, state.anchor);
        const focus = resolveEndpoint(this._muya, state.focus);
        if (!anchor || !focus)
            return null;
        const { block: anchorBlock, path: anchorPath, offset: anchorOffset } = anchor;
        const { block: focusBlock, path: focusPath, offset: focusOffset } = focus;
        const isSelectionInSameBlock = anchorBlock === focusBlock;
        const isCollapsed = isSelectionInSameBlock && anchorOffset === focusOffset;
        const order = isSelectionInSameBlock
            ? anchorOffset - focusOffset
            : comparePaths(anchorPath, focusPath);
        let direction = SelectionDirection.NONE;
        if (!isCollapsed)
            direction = order < 0 ? SelectionDirection.FORWARD : SelectionDirection.BACKWARD;
        const format = anchorBlock as Format;
        const native = this._readNative();
        const cursorCoords = native ? getCursorCoords(direction === SelectionDirection.FORWARD) : null;
        const range = native ? document.getSelection()?.getRangeAt(0) : null;
        const formats = includeFormats && isSelectionInSameBlock && typeof format.getFormatsInRange === 'function'
            ? format.getFormatsInRange().formats
            : [];
        return {
            ...state,
            context: {
                anchorBlock,
                focusBlock,
                anchorBlockInfo: endpointBlockInfo(anchorBlock)!,
                focusBlockInfo: endpointBlockInfo(focusBlock)!,
                isCollapsed,
                isSelectionInSameBlock,
                direction,
                formats,
                affiliation: buildSelectionAffiliation(anchorBlock, focusBlock),
                cursorCoords,
                selectionCoords: range?.getBoundingClientRect?.() ?? cursorCoords,
            },
        };
    }

    private _resolveImage(
        state: Extract<TSelectionState, { kind: SelectionType.IMAGE }>,
    ): IImageSelection | null {
        const { path, range, raw } = state;
        const block = resolveContent(this._muya, path) as Format | null;
        if (!block?.domNode || block.text.slice(range.start, range.end) !== raw)
            return null;
        const wrappers = block.domNode.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
        const wrapper = [...wrappers].find(node =>
            node.dataset.raw === raw && getOffsetOfParagraph(node, block.domNode!) === range.start,
        );
        if (!wrapper)
            return null;
        const imageInfo = getImageInfo(wrapper);
        const domNode = wrapper.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`);
        return {
            ...state,
            context: {
                block,
                imageInfo,
                domNode,
                affiliation: buildAffiliation(block),
                cursorCoords: null,
                selectionCoords: (domNode ?? wrapper).getBoundingClientRect(),
            },
        };
    }

    private _resolveTable(state: ITableRectSelectionState): ITableRectSelection | null {
        const { tablePath, anchor, focus } = state;
        const { row: anchorRow, column: anchorColumn } = anchor;
        const { row: focusRow, column: focusColumn } = focus;
        const block = this._muya.editor.scrollPage?.queryBlock([...tablePath]);
        if (block?.blockName !== 'table')
            return null;
        const table = block as Table;
        const coordinates = [anchorRow, anchorColumn, focusRow, focusColumn];
        if (!coordinates.every(Number.isInteger))
            return null;
        const anchorCell = table.cellAt(anchorRow, anchorColumn);
        const focusCell = table.cellAt(focusRow, focusColumn);
        if (!anchorCell || !focusCell)
            return null;
        const anchorRect = anchorCell.domNode?.getBoundingClientRect();
        const focusRect = focusCell.domNode?.getBoundingClientRect();
        let selectionCoords: TSelectionCoords | null = null;
        if (anchorRect && focusRect) {
            const left = Math.min(anchorRect.left, focusRect.left);
            const top = Math.min(anchorRect.top, focusRect.top);
            const right = Math.max(anchorRect.right, focusRect.right);
            const bottom = Math.max(anchorRect.bottom, focusRect.bottom);
            selectionCoords = {
                x: left,
                y: top,
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top,
            };
        }
        return {
            ...state,
            context: {
                table,
                anchorCell,
                focusCell,
                range: {
                    startRow: Math.min(anchorRow, focusRow),
                    endRow: Math.max(anchorRow, focusRow),
                    startColumn: Math.min(anchorColumn, focusColumn),
                    endColumn: Math.max(anchorColumn, focusColumn),
                },
                affiliation: buildSelectionAffiliation(anchorCell.firstContentInDescendant(), focusCell.firstContentInDescendant()),
                cursorCoords: null,
                selectionCoords,
            },
        };
    }

    private _isValid(selection: TSelection): boolean {
        if (selection.kind === SelectionType.TEXT) {
            const { anchor, focus, context } = selection;
            const { anchorBlock, focusBlock } = context;
            return isLegalOffset(anchorBlock.text, anchor.offset)
                && isLegalOffset(focusBlock.text, focus.offset);
        }
        if (selection.kind === SelectionType.IMAGE) {
            const { range, context } = selection;
            const { text } = context.block;
            return range.start < range.end
                && isLegalOffset(text, range.start)
                && isLegalOffset(text, range.end);
        }
        return true;
    }

    getSelectedText(): string {
        const selection = this.getSelection();
        if (selection?.kind === SelectionType.TEXT) {
            const { anchor, focus, context } = selection;
            const { anchorBlock, focusBlock } = context;
            return this._text.getSelectedText({
                anchor: {
                    ...anchor,
                    path: [...anchor.path],
                    block: anchorBlock,
                },
                focus: {
                    ...focus,
                    path: [...focus.path],
                    block: focusBlock,
                },
                ...context,
            });
        }
        if (selection?.kind === SelectionType.TABLE) {
            const { table, range } = selection.context;
            const { startRow, endRow, startColumn, endColumn } = range;
            const rows: string[] = [];
            for (let row = startRow; row <= endRow; row++) {
                const cells: string[] = [];
                for (let column = startColumn; column <= endColumn; column++)
                    cells.push(table.cellAt(row, column)?.firstContentInDescendant()?.text ?? '');
                rows.push(cells.join('\t'));
            }
            return rows.join('\n');
        }
        return '';
    }

    selectAll(): void {
        if (this.type === SelectionType.IMAGE)
            this.clear();
        if (this._muya.isReadOnly) {
            this._table.clear();
            this._text.selectAllContent();
            this.syncTextSelection();
            this.flush();
            return;
        }

        const tableSelection = this._table;

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

        // The live caret may have moved since the last cached menu selection.
        const live = this.getTextSelection();
        const anchorBlock = live ? live.anchor.block : this._text.anchorBlock;
        const focusBlock = live ? live.focus.block : this._text.focusBlock;
        const anchorOffset = live ? live.anchor.offset : this._text.anchor?.offset;
        const focusOffset = live ? live.focus.offset : this._text.focus?.offset;

        // Undo may detach the cached block without restoring a caret (#5387).
        if (anchorBlock?.outMostBlock && anchorBlock === focusBlock && anchorOffset != null && focusOffset != null) {
            if (anchorBlock.blockName === 'table.cell.content') {
                const cellBlock = anchorBlock.closestBlock('table.cell') as TableBodyCell | null;
                if (cellBlock) {
                    tableSelection.selectSingleCell(cellBlock);
                    return;
                }
            }

            if (Math.abs(focusOffset - anchorOffset) < anchorBlock.text.length) {
                const path = anchorBlock.path;
                this._text.setSelection(
                    { offset: 0, block: anchorBlock, path },
                    { offset: anchorBlock.text.length, block: anchorBlock, path },
                );
                return;
            }
        }

        this._text.selectAllContent();
    }
}

export function getCursorReference() {
    const rect = getCursorCoords();
    return rect
        ? {
                getBoundingClientRect: () => rect,
                clientWidth: rect.width,
                clientHeight: rect.height,
            }
        : null;
}

export default Selection;
