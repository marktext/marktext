import type { ISyntaxRenderOptions, StrongEmToken } from '../types';
import type Renderer from './index';

export default function em(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: StrongEmToken },
) {
    return this.delEmStrongFac('em', {
        h,
        cursor,
        block,
        token,
        outerClass,
    });
}
