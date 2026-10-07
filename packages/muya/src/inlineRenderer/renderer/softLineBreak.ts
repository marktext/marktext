import type { ISyntaxRenderOptions, SoftLineBreakToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { lineBreakHighlights } from './highlight';

export default function softLineBreak(
    this: Renderer,
    { h, token }: ISyntaxRenderOptions & { token: SoftLineBreakToken },
) {
    const { start, end } = token.range;
    let selector = `span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`;
    if (this.muya.options.softNewlineAsSpace) {
        selector += `.${CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE}`;
    }
    else if (token.isAtEnd) {
        selector += `.${CLASS_NAMES.MU_LINE_END}`;
    }

    const bands = lineBreakHighlights.call(this, h, token, start, end);

    return [h(selector, bands.length ? [...bands, token.lineBreak] : token.lineBreak)];
}
