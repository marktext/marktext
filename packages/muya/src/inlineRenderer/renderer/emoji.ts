import type { VNode } from 'snabbdom';
import type { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { validEmoji } from '../../utils/emoji';

// render token of emoji to vnode
export default function emoji(
    this: Renderer,
    { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & { token: CodeEmojiMathToken },
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
    let content: string | (VNode | string)[] = token.content;
    let pos = rStart + token.marker.length;

    if (token.highlights && token.highlights.length) {
        content = [];

        for (const light of token.highlights) {
            const { active } = light;
            let { start, end } = light;
            const HIGHLIGHT_CLASS_NAME = this.getHighlightClassName(!!active);
            if (start === rStart) {
                startMarkerSelector += `.${HIGHLIGHT_CLASS_NAME}`;
                start++;
            }

            if (end === rEnd) {
                endMarkerSelector += `.${HIGHLIGHT_CLASS_NAME}`;
                end--;
            }

            if (pos < start)
                content.push(block.text.substring(pos, start));

            if (start < end) {
                content.push(
                    h(`span.${HIGHLIGHT_CLASS_NAME}`, block.text.substring(start, end)),
                );
            }
            pos = end;
        }

        if (pos < rEnd - token.marker.length)
            content.push(block.text.substring(pos, rEnd - 1));
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
