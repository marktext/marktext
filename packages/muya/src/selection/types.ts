import type ContentBlock from '../block/base/content';
import type Format from '../block/base/format';
import type { ImageToken } from '../inlineRenderer/types';

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

// An `ISelection` whose live `anchorBlock` / `focusBlock` references are
// optional. The history stacks store selections that may have lost their block
// instances after a serialize/restore round-trip (those references are an
// in-memory optimization re-resolved from `anchorPath` / `focusPath` on apply).
// A full `ISelection` is assignable to this type, so live selections captured
// via `getSelection()` still fit without any cast.
export type IHistorySelection = Omit<ISelection, 'anchorBlock' | 'focusBlock'> & {
    anchorBlock?: ContentBlock;
    focusBlock?: ContentBlock;
};

export type SelectionType = 'text' | 'table' | 'image';

export interface IImageSelectionData {
    token: ImageToken;
    imageId: string;
    block: Format;
}
