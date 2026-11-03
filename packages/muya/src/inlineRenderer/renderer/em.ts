import type { StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function em(this: Renderer, options: ISyntaxRenderOptions & { token: StrongEmToken }) {
    return this.delEmStrongFac('em', options);
}
