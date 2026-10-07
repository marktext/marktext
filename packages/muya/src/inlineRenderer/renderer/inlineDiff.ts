import type { InlineDiffToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';

export default function inlineDiff(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: InlineDiffToken },
) {
    return this.delEmStrongFac(token.kind, {
        h,
        cursor,
        block,
        token,
        outerClass,
    });
}
