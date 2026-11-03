import type { SuperSubScriptToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedParts } from './delimitedParts';

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

    const { startMarker, content, endMarker } = delimitedParts(this, { h, block, token, cursor }, marker.length);

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
