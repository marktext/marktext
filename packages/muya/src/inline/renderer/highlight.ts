import type { Token } from '../model/types';
import type Renderer from './index';
import type { H, IRenderBlock } from './types';
import { intersectingHighlights } from '../model/ranges';
import { renderedText } from '../readingText';

export default function highlight(
    this: Renderer,
    h: H,
    block: IRenderBlock,
    rStart: number,
    rEnd: number,
    token: Token,
) {
    const { text } = block;
    const result = [];
    const matches = intersectingHighlights({ start: rStart, end: rEnd }, token.highlights ?? []);
    let pos = rStart;
    for (const { start, end, active } of matches) {
        if (pos < start)
            result.push(renderedText(this, text.slice(pos, start), pos));
        const value = text.slice(start, end);
        result.push(renderedText(this, value, start, end, h(`span.${this.getHighlightClassName(!!active)}`, value)));
        pos = end;
    }
    if (pos < rEnd || !matches.length)
        result.push(renderedText(this, text.slice(pos, rEnd), pos));
    return result;
}
