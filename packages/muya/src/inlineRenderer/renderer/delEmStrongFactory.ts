import type { VNode } from 'snabbdom';
import type { DelToken, MarkToken, StrongEmToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedRanges } from '../model/ranges';

// render factory of `del`,`mark`,`em`,`strong`
export default function delEmStrongFac(
    this: Renderer,
    type: 'del' | 'mark' | 'em' | 'strong',
    {
        h,
        cursor,
        block,
        token,
        outerClass,
        childNodes,
    }: ISyntaxRenderOptions & { token: StrongEmToken | DelToken | MarkToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const COMMON_MARKER = `span.${className}.${CLASS_NAMES.MU_REMOVE}`;
    const { marker } = token;
    const { end } = token.range;
    const { opening, closing } = delimitedRanges(token.range, marker.length);
    const backlashStart
        = end - marker.length - token.backlash.length;
    const content: (VNode | string)[] = [
        ...this.renderChildren(token.children, { h, cursor, block, childNodes }),
        ...this.backlashInToken(
            h,
            token.backlash,
            className,
            backlashStart,
            token,
        ),
    ];
    const startMarker = this.highlight(
        h,
        block,
        opening.start,
        opening.end,
        token,
    );
    const endMarker = this.highlight(h, block, closing.start, closing.end, token);

    return [
        h(COMMON_MARKER, startMarker),
        h(`${type}.${CLASS_NAMES.MU_INLINE_RULE}`, content),
        h(COMMON_MARKER, endMarker),
    ];
}
