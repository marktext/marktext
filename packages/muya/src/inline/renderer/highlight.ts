import type { Token } from '../model/types';
import type Renderer from './index';
import type { H, IRenderBlock } from './types';
import { intersectingHighlights } from '../model/ranges';

export default function highlight(
    this: Renderer,
    h: H,
    block: IRenderBlock,
    rStart: number,
    rEnd: number,
    token: Token,
) {
    const { text } = block;
    const { highlights } = token;
    let result = [];
    const unions = intersectingHighlights({ start: rStart, end: rEnd }, highlights ?? []);
    let pos = rStart;

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
