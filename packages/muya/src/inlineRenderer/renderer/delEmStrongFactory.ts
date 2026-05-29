import type { VNode } from 'snabbdom';
import type {
    DelToken,
    ISyntaxRenderOptions,
    StrongEmToken,
    Token,
} from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { snakeToCamel } from '../../utils';

// render factory of `del`,`em`,`strong`
export default function delEmStrongFac(
    this: Renderer,
    type: 'del' | 'em' | 'strong',
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: StrongEmToken | DelToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const COMMON_MARKER = `span.${className}.${CLASS_NAMES.MU_REMOVE}`;
    const { marker } = token;
    const { start, end } = token.range;
    const backlashStart
        = end - marker.length - token.backlash.length;
    const content: VNode[] = [
        ...token.children.reduce((acc: VNode[], to: Token) => {
            // The original passed a `className` field here too, but receivers
            // read `outerClass` — so the field was silently dropped under the
            // previous `as any` cast. Preserve that behavior: don't propagate.
            const chunk = this.dispatch(snakeToCamel(to.type), {
                h,
                cursor,
                block,
                token: to,
            });

            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk];
        }, []),
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
        start,
        start + marker.length,
        token,
    );
    const endMarker = this.highlight(h, block, end - marker.length, end, token);

    return [
        h(COMMON_MARKER, startMarker),
        h(`${type}.${CLASS_NAMES.MU_INLINE_RULE}`, content),
        h(COMMON_MARKER, endMarker),
    ];
}
