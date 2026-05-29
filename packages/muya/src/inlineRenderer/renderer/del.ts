import type { DelToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';

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
