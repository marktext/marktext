import type { ISyntaxRenderOptions, SuperSubScriptToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';

export default function superSubScript(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: SuperSubScriptToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;
    const { start, end } = token.range;

    const startMarker = this.highlight(
        h,
        block,
        start,
        start + marker.length,
        token,
    );
    const endMarker = this.highlight(h, block, end - marker.length, end, token);
    const content = this.highlight(
        h,
        block,
        start + marker.length,
        end - marker.length,
        token,
    );
    const tagName = marker === '^' ? 'sup' : 'sub';

    return [
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, startMarker),
        h(
            `${tagName}.${CLASS_NAMES.MU_INLINE_RULE}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            content,
        ),
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, endMarker),
    ];
}
