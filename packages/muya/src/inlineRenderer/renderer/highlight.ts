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

// A search match on a line break can't be wrapped like ordinary text: the `\n`
// must stay a bare text node so the line still breaks, and a background on an
// inline box whose only content is a forced break paints nothing. So the match
// renders as an empty inline box placed just before the break — the highlight
// classes give it width, height and a background, the end-of-line band a `\n`
// find should show.
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
