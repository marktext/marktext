import type { ITokenRange } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { delimitedRanges } from '../model/ranges';

export function delimitedParts(renderer: Renderer, { h, block, token }: ISyntaxRenderOptions, openingLength: number, closingLength = openingLength, contentRange?: ITokenRange) {
    const ranges = delimitedRanges(token.range, openingLength, closingLength, contentRange);
    const render = (range: ITokenRange) => renderer.highlight(h, block, range.start, range.end, token);
    return { startMarker: render(ranges.opening), content: render(ranges.content), endMarker: render(ranges.closing) };
}
