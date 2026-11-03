import type { VNode } from 'snabbdom';
import type { Token } from '../model/types';
import type Renderer from './index';
import type { H } from './types';
import { intersectingHighlights } from '../model/ranges';

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
    const bands: (VNode | string)[] = [];

    for (const highlight of intersectingHighlights({ start: rStart, end: rEnd }, highlights ?? []))
        bands.push(h(`span.${this.getHighlightClassName(!!highlight.active)}`));

    return bands;
}
