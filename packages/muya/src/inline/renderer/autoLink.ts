import type { AutoLinkToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedParts } from './delimitedParts';
import { hyperlinkProps, sourceDataset } from './linkData';

// render auto_link to VNode
export default function autoLink(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: AutoLinkToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { isLink, marker, href, email } = token;

    const { startMarker, content, endMarker } = delimitedParts(this, { h, block, token, cursor }, marker.length);

    const hyperlink = isLink ? href : `mailto:${email}`;

    return [
        h(`span.${className}`, startMarker),
        h(
            `a.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_AUTO_LINK}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
                props: hyperlinkProps(hyperlink, undefined, '_blank'),
                dataset: sourceDataset(token),
            },
            content,
        ),
        h(`span.${className}`, endMarker),
    ];
}
