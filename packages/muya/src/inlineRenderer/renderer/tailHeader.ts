import type { TailHeaderToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function tailHeader(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: TailHeaderToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { start, end } = token.range;
    const content = this.highlight(h, block, start, end, token);

    if (block.blockName === 'atxheading.content')
        return [h(`span.${className}`, content)];
    else
        return content;
}
