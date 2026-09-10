import type { ISyntaxRenderOptions, SoftLineBreakToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';

export default function softLineBreak(
    this: Renderer,
    { h, token }: ISyntaxRenderOptions & { token: SoftLineBreakToken },
) {
    let selector = `span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`;
    if (this.muya.options.softNewlineAsSpace) {
        selector += `.${CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE}`;
    }
    else if (token.isAtEnd) {
        selector += `.${CLASS_NAMES.MU_LINE_END}`;
    }

    return [h(selector, token.lineBreak)];
}
