import type { ISyntaxRenderOptions } from '../types';
import type Renderer from './index';

// render token of text type to vnode.
export default function text(
    this: Renderer,
    { h, block, token }: ISyntaxRenderOptions,
) {
    const { start, end } = token.range;

    return [h('span.mu-plain-text', this.highlight(h, block, start, end, token))];
}
