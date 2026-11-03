import type { DelToken } from '../model/types';
import type Renderer from './index';
import type { IContainerRenderOptions } from './types';

export default function del(this: Renderer, options: IContainerRenderOptions & { token: DelToken }) {
    return this.delEmStrongFac('del', options);
}
