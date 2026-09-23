import type Content from '../block/base/content';
import type { IAnchorFocusInfo, ISelectionEndpoints } from './types';
import { lineBounds } from '../utils';
import { resolveEndpoint } from './dom';

function endpoint(block: Content, offset: number): IAnchorFocusInfo {
    return { offset, block, path: block.path };
}

function caretAt(doc: Document, x: number, y: number): { node: Node; offset: number } | null {
    if (typeof doc.caretPositionFromPoint === 'function') {
        const position = doc.caretPositionFromPoint(x, y);

        return position && { node: position.offsetNode, offset: position.offset };
    }

    if (typeof doc.caretRangeFromPoint === 'function') {
        const range = doc.caretRangeFromPoint(x, y);

        return range && { node: range.startContainer, offset: range.startOffset };
    }

    return null;
}

export function paragraphSelectLine(
    doc: Document,
    x: number,
    y: number,
): ISelectionEndpoints | null {
    const caret = caretAt(doc, x, y);
    if (!caret)
        return null;

    const clicked = resolveEndpoint(caret.node, caret.offset);
    if (!clicked)
        return null;

    const { block } = clicked;
    const [start, end] = lineBounds(block.text, clicked.offset);

    return { anchor: endpoint(block, start), focus: endpoint(block, end) };
}
