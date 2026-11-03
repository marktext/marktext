import type { h, VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { IRenderCursor } from '../../selection/types';

import type { Token } from '../types';

export type H = typeof h;

export interface ISyntaxRenderOptions {
    h: H;
    cursor: IRenderCursor;
    block: Format;
    token: Token;
    outerClass?: string;
    childNodes?: (tokens: readonly Token[]) => (VNode | string)[];
}
