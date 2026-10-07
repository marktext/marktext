import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { H, Token } from '../types';
import type Renderer from './index';
import { union } from '../../utils';

// change text to highlight vnode
export default function highlight(
    this: Renderer,
    h: H,
    block: Format,
    rStart: number,
    rEnd: number,
    token: Token,
) {
    const { text } = block;
    const { highlights } = token;
    let result = [];
    const unions = [];
    let pos = rStart;

    if (highlights) {
        for (const light of highlights) {
            const un = union({ start: rStart, end: rEnd }, light);
            if (un)
                unions.push(un);
        }
    }

    if (unions.length) {
        for (const u of unions) {
            const { start, end, active } = u;
            const className = this.getHighlightClassName(!!active);

            if (pos < start)
                result.push(text.substring(pos, start));

            result.push(h(`span.${className}`, text.substring(start, end)));
            pos = end;
        }

        if (pos < rEnd)
            result.push(block.text.substring(pos, rEnd));
    }
    else {
        result = [text.substring(rStart, rEnd)];
    }

    return result;
}

// Empty and out of flow: the `\n` has to stay raw text or the line stops
// breaking, and a background on a box whose only content is a break paints
// nothing, so the band is drawn by the box itself (see the line-break CSS).
export function lineBreakHighlights(
    this: Renderer,
    h: H,
    token: Token,
    rStart: number,
    rEnd: number,
) {
    const { highlights } = token;
    const bands: VNode[] = [];

    if (highlights) {
        for (const light of highlights) {
            const un = union({ start: rStart, end: rEnd }, light);
            if (un)
                bands.push(h(`span.${this.getHighlightClassName(!!un.active)}`));
        }
    }

    return bands;
}
