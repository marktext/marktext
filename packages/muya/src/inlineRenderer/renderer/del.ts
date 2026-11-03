import type { DelToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';

export default function del(this: Renderer, options: ISyntaxRenderOptions & { token: DelToken }) {
    return this.delEmStrongFac('del', options);
}
