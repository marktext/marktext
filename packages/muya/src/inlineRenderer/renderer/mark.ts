import type { MarkToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function mark(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: MarkToken },
) {
    return this.delEmStrongFac('mark', {
        h,
        cursor,
        block,
        token,
        outerClass,
    });
}
