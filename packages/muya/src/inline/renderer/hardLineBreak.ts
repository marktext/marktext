import type { HardLineBreakToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';

export default function hardLineBreak(
    this: Renderer,
    { h, token, block, cursor, outerClass }: ISyntaxRenderOptions & { token: HardLineBreakToken },
) {
    const { marker, lineBreak, leadingSpaces, isAtEnd } = token;
    const { start, end } = token.range;
    const lineStart = start + marker.length;
    const bands = this.lineBreakHighlights(
        h,
        token,
        lineStart,
        lineStart + lineBreak.length,
    );
    const className = CLASS_NAMES.MU_HARD_LINE_BREAK;
    const spaceClass = CLASS_NAMES.MU_HARD_LINE_BREAK_SPACE;
    const syntaxClass = this.getClassName(outerClass, block, token, cursor);
    const markerContent = marker === '\\'
        ? h(`span.${syntaxClass}.${CLASS_NAMES.MU_REMOVE}`, this.highlight(h, block, start, lineStart, token))
        : marker;
    const markerNode = h(`span.${spaceClass}`, markerContent);
    const indentation = leadingSpaces
        ? [h(`span.${syntaxClass}.${CLASS_NAMES.MU_REMOVE}`, this.highlight(h, block, lineStart + lineBreak.length, end, token))]
        : [];

    if (isAtEnd) {
        return [
            h(`span.${className}`, markerNode),
            h(`span.${CLASS_NAMES.MU_LINE_END}`, bands.length ? [...bands, lineBreak] : lineBreak),
            ...indentation,
        ];
    }
    else {
        return [
            h(`span.${className}`, bands.length
                ? [...bands, markerNode, lineBreak]
                : [markerNode, lineBreak]),
            ...indentation,
        ];
    }
}
