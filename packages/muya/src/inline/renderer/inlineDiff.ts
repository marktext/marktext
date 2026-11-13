import type { InlineDiffToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedParts } from './delimitedParts';

export default function inlineDiff(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: InlineDiffToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;
    const addition = marker[1] === '+';
    const tag = addition ? 'ins' : 'del';
    const variant = addition ? 'mu-inline-diff-addition' : 'mu-inline-diff-deletion';

    const { startMarker, content, endMarker } = delimitedParts(this, { h, block, token, cursor }, marker.length);

    return [
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, startMarker),
        h(`${tag}.${CLASS_NAMES.MU_INLINE_RULE}.${variant}`, content),
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, endMarker),
    ];
}
