import type { StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { IContainerRenderOptions } from './types';

export default function strong(this: Renderer, options: IContainerRenderOptions & { token: StrongEmToken }) {
    return this.delEmStrongFac('strong', options);
}
