import type { TextToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';

export default function text(
    this: Renderer,
    { h, block, token, cursor, outerClass }: ISyntaxRenderOptions & { token: TextToken },
) {
    const { start, end } = token.range;

    const contentEnd = start + token.content.length;
    const nodes = [h('span.mu-plain-text', this.highlight(h, block, start, contentEnd, token))];
    if (contentEnd < end) {
        // Ignored paragraph whitespace stays editable without affecting reading semantics (#5995).
        const className = this.getClassName(outerClass, block, token, cursor);
        nodes.push(h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, this.highlight(h, block, contentEnd, end, token)));
    }
    return nodes;
}
