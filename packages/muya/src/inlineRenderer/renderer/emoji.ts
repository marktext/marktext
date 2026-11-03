import type { EmojiToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { validEmoji } from '../../utils/emoji';

// render token of emoji to vnode
export default function emoji(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: EmojiToken },
) {
    const { start: rStart, end: rEnd } = token.range;
    const className = this.getClassName(outerClass, block, token, cursor);
    const validation = validEmoji(token.content);
    const finalClass = validation ? className : CLASS_NAMES.MU_WARN;
    const contentSelector
        = finalClass !== CLASS_NAMES.MU_GRAY
            ? `span.${finalClass}.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_EMOJI_MARKED_TEXT}`
            : `span.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_EMOJI_MARKED_TEXT}`;

    let startMarkerSelector = `span.${finalClass}.${CLASS_NAMES.MU_EMOJI_MARKER}`;
    let endMarkerSelector = startMarkerSelector;
    const content = this.highlight(h, block, rStart + token.marker.length, rEnd - token.marker.length, token);
    for (const light of token.highlights ?? []) {
        const highlightClass = this.getHighlightClassName(!!light.active);
        if (light.start === rStart)
            startMarkerSelector += `.${highlightClass}`;
        if (light.end === rEnd)
            endMarkerSelector += `.${highlightClass}`;
    }

    const emojiVNode = validation
        ? h(
                contentSelector,
                {
                    attrs: {
                        spellcheck: 'false',
                    },
                    dataset: {
                        emoji: validation.emoji,
                    },
                },
                content,
            )
        : h(contentSelector, content);

    return [
        h(startMarkerSelector, token.marker),
        emojiVNode,
        h(endMarkerSelector, token.marker),
    ];
}
