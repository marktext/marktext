import type { MarkToken } from '../model/types';
import type Renderer from './index';
import type { IContainerRenderOptions } from './types';

export default function mark(this: Renderer, options: IContainerRenderOptions & { token: MarkToken }) {
    return this.delEmStrongFac('mark', options);
}
