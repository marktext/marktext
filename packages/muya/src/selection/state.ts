import type Content from '../block/base/content';
import type { TBlockPath } from '../block/types';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, ISelectionEndpoint, ITextSelectionState, TSelectionState } from './types';
import { SelectionType } from './types';

export function contentPath(block: Content): TBlockPath {
    return block.blockName === 'language-input'
        ? [...block.parent!.path, 'meta', 'lang']
        : [...block.path];
}

export function createTextSelectionState(anchor: IAnchorFocusInfo, focus: IAnchorFocusInfo): ITextSelectionState {
    return {
        kind: SelectionType.TEXT,
        anchor: { path: contentPath(anchor.block), offset: anchor.offset },
        focus: { path: contentPath(focus.block), offset: focus.offset },
    };
}

export function resolveContent(muya: Muya, path: Readonly<TBlockPath>): Content | null {
    const language = path.at(-2) === 'meta' && path.at(-1) === 'lang';
    const block = muya.editor.scrollPage?.queryBlock(language ? path.slice(0, -2) : [...path]);
    if (language) {
        return block?.isParent() && block.blockName === 'code-block' && block.firstContentInDescendant()?.blockName === 'language-input'
            ? block.firstContentInDescendant()
            : null;
    }
    return block?.isContent() ? block : null;
}

export function resolveEndpoint(muya: Muya, point: ISelectionEndpoint): IAnchorFocusInfo | null {
    const block = resolveContent(muya, point.path);
    if (!block)
        return null;
    return { block, path: [...point.path], offset: point.offset };
}

export function isLegalOffset(text: string, offset: number): boolean {
    if (!Number.isInteger(offset) || offset < 0 || offset > text.length)
        return false;
    const before = text.charCodeAt(offset - 1);
    const after = text.charCodeAt(offset);
    return !(before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF);
}

export function copySelectionState(state: TSelectionState | null): TSelectionState | null {
    if (!state)
        return null;
    switch (state.kind) {
        case SelectionType.TEXT:
            return {
                kind: state.kind,
                anchor: { path: [...state.anchor.path], offset: state.anchor.offset },
                focus: { path: [...state.focus.path], offset: state.focus.offset },
            };
        case SelectionType.IMAGE:
            return { kind: state.kind, path: [...state.path], range: { start: state.range.start, end: state.range.end }, raw: state.raw };
        case SelectionType.TABLE:
            return { kind: state.kind, tablePath: [...state.tablePath], anchor: { row: state.anchor.row, column: state.anchor.column }, focus: { row: state.focus.row, column: state.focus.column } };
    }
}

export function equalSelections(a: TSelectionState | null, b: TSelectionState | null): boolean {
    return JSON.stringify(copySelectionState(a)) === JSON.stringify(copySelectionState(b));
}

function isPath(path: unknown): path is TBlockPath {
    return Array.isArray(path) && path.length > 0
        && path.every(part => typeof part === 'string' || (Number.isInteger(part) && part >= 0));
}

export function isSelectionState(value: unknown): value is TSelectionState {
    if (!value || typeof value !== 'object' || !('kind' in value))
        return false;
    if (value.kind === SelectionType.IMAGE)
        return isImageState(value);
    if (!('anchor' in value) || !('focus' in value))
        return false;
    const points = [value.anchor, value.focus];
    if (value.kind === SelectionType.TEXT) {
        return points.every(point => !!point && typeof point === 'object'
            && 'path' in point && isPath(point.path) && 'offset' in point && Number.isInteger(point.offset));
    }
    if (value.kind === SelectionType.TABLE) {
        return 'tablePath' in value && isPath(value.tablePath)
            && points.every(point => !!point && typeof point === 'object'
                && 'row' in point && Number.isInteger(point.row)
                && 'column' in point && Number.isInteger(point.column));
    }
    return false;
}

function isImageState(value: object): boolean {
    return 'path' in value && isPath(value.path) && 'raw' in value && typeof value.raw === 'string'
        && 'range' in value && !!value.range && typeof value.range === 'object'
        && 'start' in value.range && Number.isInteger(value.range.start)
        && 'end' in value.range && Number.isInteger(value.range.end);
}
