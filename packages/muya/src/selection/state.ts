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

export function createTextSelectionState(
    anchor: IAnchorFocusInfo,
    focus: IAnchorFocusInfo,
): ITextSelectionState {
    const { block: anchorBlock, offset: anchorOffset } = anchor;
    const { block: focusBlock, offset: focusOffset } = focus;
    return {
        kind: SelectionType.TEXT,
        anchor: {
            path: contentPath(anchorBlock),
            offset: anchorOffset,
        },
        focus: {
            path: contentPath(focusBlock),
            offset: focusOffset,
        },
    };
}

export function resolveContent(muya: Muya, path: Readonly<TBlockPath>): Content | null {
    const language = path.at(-2) === 'meta' && path.at(-1) === 'lang';
    const block = muya.editor.scrollPage?.queryBlock(language ? path.slice(0, -2) : [...path]);
    if (!language)
        return block?.isContent() ? block : null;
    if (!block?.isParent() || block.blockName !== 'code-block')
        return null;

    const content = block.firstContentInDescendant();
    return content?.blockName === 'language-input' ? content : null;
}

export function resolveEndpoint(muya: Muya, point: ISelectionEndpoint): IAnchorFocusInfo | null {
    const { path, offset } = point;
    const block = resolveContent(muya, path);
    if (!block)
        return null;
    return {
        block,
        path: [...path],
        offset,
    };
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
        case SelectionType.TEXT: {
            const { kind, anchor, focus } = state;
            const { path: anchorPath, offset: anchorOffset } = anchor;
            const { path: focusPath, offset: focusOffset } = focus;
            return {
                kind,
                anchor: {
                    path: [...anchorPath],
                    offset: anchorOffset,
                },
                focus: {
                    path: [...focusPath],
                    offset: focusOffset,
                },
            };
        }
        case SelectionType.IMAGE: {
            const { kind, path, range, raw } = state;
            const { start, end } = range;
            return {
                kind,
                path: [...path],
                range: {
                    start,
                    end,
                },
                raw,
            };
        }
        case SelectionType.TABLE: {
            const { kind, tablePath, anchor, focus } = state;
            const { row: anchorRow, column: anchorColumn } = anchor;
            const { row: focusRow, column: focusColumn } = focus;
            return {
                kind,
                tablePath: [...tablePath],
                anchor: {
                    row: anchorRow,
                    column: anchorColumn,
                },
                focus: {
                    row: focusRow,
                    column: focusColumn,
                },
            };
        }
    }
}

export function equalSelections(a: TSelectionState | null, b: TSelectionState | null): boolean {
    return JSON.stringify(copySelectionState(a)) === JSON.stringify(copySelectionState(b));
}

function isPath(path: unknown): path is TBlockPath {
    return Array.isArray(path) && path.length > 0
        && path.every(part => typeof part === 'string' || (Number.isInteger(part) && part >= 0));
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

export function isSelectionState(value: unknown): value is TSelectionState {
    if (!isObject(value))
        return false;

    const { kind, anchor, focus } = value;
    const points = [anchor, focus];
    switch (kind) {
        case SelectionType.TEXT:
            return points.every(point => isObject(point)
                && isPath(point.path)
                && Number.isInteger(point.offset));
        case SelectionType.IMAGE:
            return isImageState(value);
        case SelectionType.TABLE:
            return isPath(value.tablePath)
                && points.every(point => isObject(point)
                    && Number.isInteger(point.row)
                    && Number.isInteger(point.column));
        default:
            return false;
    }
}

function isImageState({ path, raw, range }: Record<string, unknown>): boolean {
    return isPath(path)
        && typeof raw === 'string'
        && isObject(range)
        && Number.isInteger(range.start)
        && Number.isInteger(range.end);
}
