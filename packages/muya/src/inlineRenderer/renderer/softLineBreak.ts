import type { ISyntaxRenderOptions, SoftLineBreakToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';

export default function softLineBreak(
    this: Renderer,
    { h, token }: ISyntaxRenderOptions & { token: SoftLineBreakToken },
) {
    const { lineBreak, isAtEnd } = token;
    let selector = `span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`;
    if (isAtEnd)
        selector += `.${CLASS_NAMES.MU_LINE_END}`;

    return [h(selector, lineBreak)];
}
