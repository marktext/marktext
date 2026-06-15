import type ContentBlock from '../block/base/content';
import type Format from '../block/base/format';
import type { TBlockPath } from '../block/types';
import type { ImageToken } from '../inlineRenderer/types';

export interface INodeOffset {
    offset: number;
}

export interface IContentCursor extends ISelection {
    start: INodeOffset;
    end: INodeOffset;
}

export interface IRenderCursor {
    start?: INodeOffset;
    end?: INodeOffset;
    anchor?: INodeOffset;
    focus?: INodeOffset;
    block?: ContentBlock;
}

export interface IPublicCursorInput {
    start?: INodeOffset | null;
    end?: INodeOffset | null;
    anchor?: INodeOffset | null;
    focus?: INodeOffset | null;
    block?: ContentBlock;
    path?: TBlockPath;
    anchorBlock?: ContentBlock;
    anchorPath?: TBlockPath;
    focusBlock?: ContentBlock;
    focusPath?: TBlockPath;
}

export interface IPathCursor {
    anchor: INodeOffset;
    anchorPath: TBlockPath;
    focus: INodeOffset;
    focusPath: TBlockPath;
}

// One endpoint of a selection: the offset plus the live block reference and its
// json path. `block` is an in-memory optimization re-resolved from `path` on
// apply, so the history variant below makes it optional.
export interface IAnchorFocusInfo {
    offset: number;
    block: ContentBlock;
    path: TBlockPath;
}

// Only used for selection.getSelection return type.
export interface ISelection {
    anchor: IAnchorFocusInfo;
    focus: IAnchorFocusInfo;
    isCollapsed: boolean;
    isSelectionInSameBlock: boolean;
    direction: SelectionDirection;
    type: SelectionCaretType;
}

// An endpoint whose live `block` reference is optional — used by the history
// stacks, whose selections may have lost their block instances after a
// serialize/restore round-trip (the reference is re-resolved from `path` on
// apply).
export type IHistoryAnchorFocusInfo = Omit<IAnchorFocusInfo, 'block'> & {
    block?: ContentBlock;
};

// An `ISelection` whose endpoints' live `block` references are optional. A full
// `ISelection` is assignable to this type, so live selections captured via
// `getSelection()` still fit without any cast.
export type IHistorySelection = Omit<ISelection, 'anchor' | 'focus'> & {
    anchor: IHistoryAnchorFocusInfo;
    focus: IHistoryAnchorFocusInfo;
};

export enum SelectionType {
    Text = 'text',
    Table = 'table',
    Image = 'image',
}

export enum SelectionDirection {
    None = 'none',
    Forward = 'forward',
    Backward = 'backward',
}

export enum SelectionCaretType {
    None = 'None',
    Caret = 'Caret',
    Range = 'Range',
}

export interface IImageSelectionData {
    token: ImageToken;
    imageId: string;
    block: Format;
}
