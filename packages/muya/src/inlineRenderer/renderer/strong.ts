import type { ISyntaxRenderOptions, StrongEmToken } from '../types';
import type Renderer from './index';

export default function strong(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: StrongEmToken },
) {
    return this.delEmStrongFac('strong', {
        h,
        cursor,
        block,
        token,
        outerClass,
    });
}
