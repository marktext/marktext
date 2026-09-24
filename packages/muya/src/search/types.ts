import type Content from '../block/base/content';

export interface ISearchOption {
    isCaseSensitive?: boolean;
    isWholeWord?: boolean;
    isRegexp?: boolean;
    selectHighlight?: boolean;
    highlightIndex?: number;
}

// `replace` takes every search option plus the one that decides how many
// matches it rewrites.
export interface IReplaceOption extends ISearchOption {
    isSingle?: boolean;
}

export interface IMatch {
    start: number;
    end: number;
    block: Content;
    match: string;
    subMatches: (string | undefined)[];
}
