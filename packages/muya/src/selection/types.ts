import type ContentBlock from '../block/base/content';

export interface INodeOffset {
    offset: number;
}

// TODO: @JOCS, optimization of Cursor type, split it into for getCursor return type and setSelection params type?
export interface ICursor {
    start?: INodeOffset | null;
    end?: INodeOffset | null;
    block?: ContentBlock;
    path?: (string | number)[];
    // The same as TSelection
    anchor?: INodeOffset | null;
    focus?: INodeOffset | null;
    anchorBlock?: ContentBlock;
    anchorPath?: (string | number)[];
    focusBlock?: ContentBlock;
    focusPath?: (string | number)[];
    isCollapsed?: boolean;
    isSelectionInSameBlock?: boolean;
    direction?: string;
    type?: string;
}

// Only used for selection.getSelection return type.
export interface ISelection {
    anchor: INodeOffset;
    focus: INodeOffset;
    anchorBlock: ContentBlock;
    anchorPath: (string | number)[];
    focusBlock: ContentBlock;
    focusPath: (string | number)[];
    isCollapsed: boolean;
    isSelectionInSameBlock: boolean;
    direction: string;
    type: string;
}
