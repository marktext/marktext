import type { AutoLinkExtensionToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { hyperlinkProps, sourceDataset } from './linkData';

// render auto_link to vnode
export default function autoLinkExtension(
    this: Renderer,
    { h, block, token }: ISyntaxRenderOptions & { token: AutoLinkExtensionToken },
) {
    const { linkType, www, url, email } = token;
    const { start, end } = token.range;

    const content = this.highlight(h, block, start, end, token);
    const hyperlink
        = linkType === 'www'
            ? encodeURI(`http://${www}`)
            : linkType === 'url'
                ? encodeURI(url)
                : `mailto:${email}`;

    return [
        h(
            `a.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_AUTO_LINK_EXTENSION}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
                props: hyperlinkProps(hyperlink, undefined, '_blank'),
                dataset: sourceDataset(token),
            },
            content,
        ),
    ];
}
