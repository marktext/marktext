import type { ReferenceLinkToken } from '../model/types';
import type Renderer from './index';
import type { IContainerRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { normalizeReferenceLabel } from '../referenceLabel';
import { hyperlinkProps, sourceDataset } from './linkData';

export default function referenceLink(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
        childNodes,
    }: IContainerRenderOptions & { token: ReferenceLinkToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const labelClass
        = className === CLASS_NAMES.MU_GRAY
            ? CLASS_NAMES.MU_REFERENCE_LABEL
            : className;

    const { start, end } = token.range;
    const { anchor, children, backlash, isFullLink, label } = token;
    const MARKER = '[';
    const key = normalizeReferenceLabel(label + backlash.second);
    const backlashStart = start + MARKER.length + anchor.length;
    const content = [
        ...childNodes(children),
        ...this.backlashInToken(h, backlash.first, className, backlashStart, token),
    ];

    const { href, title } = this.environment.references.get(key) ?? {};
    const startMarker = this.highlight(
        h,
        block,
        start,
        start + MARKER.length,
        token,
    );
    const endMarker = this.highlight(
        h,
        block,
        start + MARKER.length + anchor.length + backlash.first.length,
        end,
        token,
    );
    const anchorSelector = href
        ? `a.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_REFERENCE_LINK}`
        : `span.${CLASS_NAMES.MU_REFERENCE_LINK}`;
    const data = {
        attrs: {
            spellcheck: 'false',
        },
        props: {
            title,
        },
        dataset: sourceDataset(token),
    };

    if (href)
        Object.assign(data.props, hyperlinkProps(href));

    if (isFullLink) {
        const labelContent = this.highlight(
            h,
            block,
            start + 3 * MARKER.length + anchor.length + backlash.first.length,
            end - MARKER.length - backlash.second.length,
            token,
        );
        const middleMarker = this.highlight(
            h,
            block,
            start + MARKER.length + anchor.length + backlash.first.length,
            start + 3 * MARKER.length + anchor.length + backlash.first.length,
            token,
        );
        const lastMarker = this.highlight(
            h,
            block,
            end - MARKER.length,
            end,
            token,
        );
        const secondBacklashStart = end - MARKER.length - backlash.second.length;

        return [
            h(`span.${className}`, startMarker),
            h(anchorSelector, data, content),
            h(`span.${className}`, middleMarker),
            h(`span.${labelClass}`, labelContent),
            ...this.backlashInToken(
                h,
                backlash.second,
                className,
                secondBacklashStart,
                token,
            ),
            h(`span.${className}`, lastMarker),
        ];
    }
    else {
        return [
            h(`span.${className}`, startMarker),
            h(anchorSelector, data, content),
            h(`span.${className}`, endMarker),
        ];
    }
}
