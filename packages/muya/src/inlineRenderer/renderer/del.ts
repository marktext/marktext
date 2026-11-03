import type { DelToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function del(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: DelToken },
) {
    return this.delEmStrongFac('del', {
        h,
        cursor,
        block,
        token,
        outerClass,
    });
}
