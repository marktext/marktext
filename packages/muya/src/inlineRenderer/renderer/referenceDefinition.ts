import type { ISyntaxRenderOptions, ReferenceDefinitionToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';

export default function referenceDefinition(
    this: Renderer,
    { h, block, token }: ISyntaxRenderOptions & { token: ReferenceDefinitionToken },
) {
    const className = CLASS_NAMES.MU_REFERENCE_MARKER;
    const {
        leftBracket,
        label,
        backlash,
        // rightBracket,
        // leftHrefMarker,
        // href,
        // rightHrefMarker,
        titleMarker,
        title,
        rightTitleSpace,
    } = token;
    const { start, end } = token.range;
    const leftBracketContent = this.highlight(
        h,
        block,
        start,
        start + leftBracket.length,
        token,
    );
    const labelContent = this.highlight(
        h,
        block,
        start + leftBracket.length,
        start + leftBracket.length + label.length,
        token,
    );
    const middleContent = this.highlight(
        h,
        block,
        start + leftBracket.length + label.length + backlash.length,
        end - rightTitleSpace.length - titleMarker.length - title.length,
        token,
    );
    const titleContent = this.highlight(
        h,
        block,
        end - rightTitleSpace.length - titleMarker.length - title.length,
        end - titleMarker.length - rightTitleSpace.length,
        token,
    );
    const rightContent = this.highlight(
        h,
        block,
        end - titleMarker.length - rightTitleSpace.length,
        end,
        token,
    );
    const backlashStart = start + leftBracket.length + label.length;

    return [
        h(`span.${className}`, leftBracketContent),
        h(
            `span.${CLASS_NAMES.MU_REFERENCE_LABEL}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            labelContent,
        ),
        ...this.backlashInToken(
            h,
            backlash,
            CLASS_NAMES.MU_GRAY,
            backlashStart,
            token,
        ),
        h(
            `span.${className}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            middleContent,
        ),
        h(`span.${CLASS_NAMES.MU_REFERENCE_TITLE}`, titleContent),
        h(
            `span.${className}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            rightContent,
        ),
    ];
}
