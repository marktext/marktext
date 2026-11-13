import type { FootnoteIdentifierToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedParts } from './delimitedParts';

export default function footnoteIdentifier(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: FootnoteIdentifierToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;

    const { startMarker, content, endMarker } = delimitedParts(this, { h, block, token, cursor }, marker.length, 1);

    return [
        h(
            `sup.${CLASS_NAMES.MU_INLINE_FOOTNOTE_IDENTIFIER}.${CLASS_NAMES.MU_INLINE_RULE}`,
            { attrs: { id: `noteref-${token.content}` } },
            [
                h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, startMarker),
                h(
                    'a',
                    {
                        attrs: {
                            spellcheck: 'false',
                        },
                    },
                    content,
                ),
                h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, endMarker),
            ],
        ),
    ];
}
