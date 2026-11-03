import type { StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

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
