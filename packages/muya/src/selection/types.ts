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

export interface IAnchorFocusInfo {
    offset: number;
    block: ContentBlock;
    path: TBlockPath;
}

export interface ISelectionEndpoints {
    anchor: IAnchorFocusInfo;
    focus: IAnchorFocusInfo;
}

export interface ISelection extends ISelectionEndpoints {
    isCollapsed: boolean;
    isSelectionInSameBlock: boolean;
    direction: SelectionDirection;
    type: SelectionCaretType;
}

// Live block references are optional after history serialization; restore them from paths.
export type IHistoryAnchorFocusInfo = Omit<IAnchorFocusInfo, 'block'> & {
    block?: ContentBlock;
};

export type IHistorySelection = Omit<ISelection, 'anchor' | 'focus'> & {
    anchor: IHistoryAnchorFocusInfo;
    focus: IHistoryAnchorFocusInfo;
};

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

export enum SelectionCaretType {
    NONE = 'None',
    CARET = 'Caret',
    RANGE = 'Range',
}

export interface IImageSelectionData {
    token: ImageToken;
    imageId: string;
    block: Format;
}
