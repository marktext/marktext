import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { TBlockPath } from '../block/types';
import type { ITokenRange, Token } from '../inlineRenderer/types';
import type { IImageInfo } from '../utils/image';
import type { IAffiliationEntry, IEndpointBlockInfo } from './affiliation';

export enum SelectionType {
    TEXT = 'text',
    TABLE = 'table',
    IMAGE = 'image',
}

export enum SelectionDirection {
    NONE = 'none',
    FORWARD = 'forward',
    BACKWARD = 'backward',
}

export interface INodeOffset {
    offset: number;
}

export interface IAnchorFocusInfo extends INodeOffset {
    block: Content;
    path: TBlockPath;
}

export interface ISelectionEndpoints {
    anchor: IAnchorFocusInfo;
    focus: IAnchorFocusInfo;
}

export interface IResolvedTextSelection extends ISelectionEndpoints {
    isCollapsed: boolean;
    isSelectionInSameBlock: boolean;
    direction: SelectionDirection;
}

export interface IContentCursor extends IResolvedTextSelection {
    start: INodeOffset;
    end: INodeOffset;
}

export interface IRenderCursor {
    start?: INodeOffset;
    end?: INodeOffset;
    anchor?: INodeOffset;
    focus?: INodeOffset;
    block?: Content;
}

/** Offsets count UTF-16 code units in the source string at path. */
export interface ISelectionEndpoint {
    readonly path: Readonly<TBlockPath>;
    readonly offset: number;
}

export interface ITextSelectionState {
    readonly kind: SelectionType.TEXT;
    readonly anchor: ISelectionEndpoint;
    readonly focus: ISelectionEndpoint;
}

/** range is [start, end) in the content string; raw validates that exact target. */
export interface IImageSelectionState {
    readonly kind: SelectionType.IMAGE;
    readonly path: Readonly<TBlockPath>;
    readonly range: Readonly<ITokenRange>;
    readonly raw: string;
}

/** Zero-based coordinates, including the header row. */
export interface ITableCellPosition {
    readonly row: number;
    readonly column: number;
}

export interface ITableRectSelectionState {
    readonly kind: SelectionType.TABLE;
    readonly tablePath: Readonly<TBlockPath>;
    readonly anchor: ITableCellPosition;
    readonly focus: ITableCellPosition;
}

export type TSelectionState = ITextSelectionState | IImageSelectionState | ITableRectSelectionState;

export type TSelectionCoords = Readonly<Pick<DOMRectReadOnly, 'x' | 'y' | 'width' | 'height' | 'top' | 'right' | 'bottom' | 'left'>>;

export interface ITableSelectionRange {
    readonly startRow: number;
    readonly startColumn: number;
    readonly endRow: number;
    readonly endColumn: number;
}

interface ISelectionContext {
    readonly selectionCoords: TSelectionCoords | null;
    readonly cursorCoords: TSelectionCoords | null;
    readonly affiliation: readonly IAffiliationEntry[];
}

export interface ITextSelectionContext extends ISelectionContext {
    readonly anchorBlock: Content;
    readonly focusBlock: Content;
    readonly anchorBlockInfo: IEndpointBlockInfo;
    readonly focusBlockInfo: IEndpointBlockInfo;
    readonly isCollapsed: boolean;
    readonly isSelectionInSameBlock: boolean;
    readonly direction: SelectionDirection;
    readonly formats: readonly Token[];
}

export interface IImageSelectionContext extends ISelectionContext {
    readonly block: Format;
    readonly imageInfo: IImageInfo;
    readonly domNode: HTMLElement | null;
}

export interface ITableRectSelectionContext extends ISelectionContext {
    readonly table: Table;
    readonly anchorCell: TableBodyCell;
    readonly focusCell: TableBodyCell;
    readonly range: ITableSelectionRange;
}

export interface ITextSelection extends ITextSelectionState {
    readonly context: ITextSelectionContext;
}

export interface IImageSelection extends IImageSelectionState {
    readonly context: IImageSelectionContext;
}

export interface ITableRectSelection extends ITableRectSelectionState {
    readonly context: ITableRectSelectionContext;
}

export type TSelection = ITextSelection | IImageSelection | ITableRectSelection;

export interface ISelectionChangePayload {
    readonly selection: TSelection | null;
    readonly docChanged: boolean;
}
