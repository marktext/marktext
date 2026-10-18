import type { ISyntaxRenderOptions, MarkToken } from '../types';
import type Renderer from './index';

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
