import type { StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { IContainerRenderOptions } from './types';

export default function em(this: Renderer, options: IContainerRenderOptions & { token: StrongEmToken }) {
    return this.delEmStrongFac('em', options);
}
