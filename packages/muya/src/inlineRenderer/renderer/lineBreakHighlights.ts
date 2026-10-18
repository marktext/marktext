import type { VNode } from 'snabbdom';
import type { H, Token } from '../types';
import type Renderer from './index';
import { union } from '../../utils';

// Empty and out of flow: the `\n` has to stay raw text or the line stops
// breaking, and a background on a box whose only content is a break paints
// nothing, so the band is drawn by the box itself (see the line-break CSS).
export default function lineBreakHighlights(
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
