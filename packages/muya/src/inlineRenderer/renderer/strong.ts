import type { StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function strong(this: Renderer, options: ISyntaxRenderOptions & { token: StrongEmToken }) {
    return this.delEmStrongFac('strong', options);
}
