import type { VNode } from 'snabbdom';
import type { ISyntaxRenderOptions, LinkToken, Token } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { isLengthEven, snakeToCamel } from '../../utils';
import { sanitizeHyperlink } from '../../utils/url';

// 'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
export default function link(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: LinkToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const linkClassName
        = className === CLASS_NAMES.MU_HIDE
            ? className
            : CLASS_NAMES.MU_LINK_IN_BRACKET;
    const { start, end } = token.range;
    const firstMiddleBracket = this.highlight(h, block, start, start + 3, token);

    const firstBracket = this.highlight(h, block, start, start + 1, token);
    const middleBracket = this.highlight(
        h,
        block,
        start + 1 + token.anchor.length + token.backlash.first.length,
        start + 1 + token.anchor.length + token.backlash.first.length + 2,
        token,
    );
    const hrefContent = this.highlight(
        h,
        block,
        start + 1 + token.anchor.length + token.backlash.first.length + 2,
        start
        + 1
        + token.anchor.length
        + token.backlash.first.length
        + 2
        + token.hrefAndTitle.length,
        token,
    );

    const middleHref = this.highlight(
        h,
        block,
        start + 1 + token.anchor.length + token.backlash.first.length,
        start
        + 1
        + token.anchor.length
        + token.backlash.first.length
        + 2
        + token.hrefAndTitle.length,
        token,
    );

    const lastBracket = this.highlight(h, block, end - 1, end, token);

    const firstBacklashStart = start + 1 + token.anchor.length;
    const secondBacklashStart = end - 1 - token.backlash.second.length;

    if (
        isLengthEven(token.backlash.first)
        && isLengthEven(token.backlash.second)
    ) {
        if (!token.children.length && !token.backlash.first) {
            // no-text-link
            return [
                h(
                    `span.${CLASS_NAMES.MU_GRAY}.${CLASS_NAMES.MU_REMOVE}`,
                    firstMiddleBracket,
                ),
                h(
                    `a.${CLASS_NAMES.MU_NO_TEXT_LINK}.${CLASS_NAMES.MU_INLINE_RULE}`,
                    {
                        props: {
                            href: sanitizeHyperlink(
                                token.href + encodeURI(token.backlash.second),
                            ),
                            target: '_blank',
                            title: token.title,
                        },
                    },
                    [
                        ...hrefContent,
                        ...this.backlashInToken(
                            h,
                            token.backlash.second,
                            className,
                            secondBacklashStart,
                            token,
                        ),
                    ],
                ),
                h(`span.${CLASS_NAMES.MU_GRAY}.${CLASS_NAMES.MU_REMOVE}`, lastBracket),
            ];
        }
        else {
            // has children
            return [
                h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, firstBracket),
                h(
                    `span.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_LINK}`,
                    {
                        props: {
                            href: sanitizeHyperlink(
                                token.href + encodeURI(token.backlash.second),
                            ),
                            title: token.title,
                        },
                        dataset: {
                            start: String(start),
                            end: String(end),
                            raw: token.raw,
                        },
                    },
                    [
                        ...token.children.reduce((acc: VNode[], to: Token) => {
                            // The original passed a `className` field too, but
                            // receivers read `outerClass` — so it was silently
                            // dropped under the previous `as any` cast.
                            const chunk = this.dispatch(snakeToCamel(to.type), {
                                h,
                                cursor,
                                block,
                                token: to,
                            });
                            return Array.isArray(chunk)
                                ? [...acc, ...chunk]
                                : [...acc, chunk];
                        }, []),
                        ...this.backlashInToken(
                            h,
                            token.backlash.first,
                            className,
                            firstBacklashStart,
                            token,
                        ),
                    ],
                ),
                h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, middleBracket),
                h(
                    `span.${linkClassName}.${CLASS_NAMES.MU_REMOVE}`,
                    {
                        attrs: { spellcheck: 'false' },
                    },
                    [
                        ...hrefContent,
                        ...this.backlashInToken(
                            h,
                            token.backlash.second,
                            className,
                            secondBacklashStart,
                            token,
                        ),
                    ],
                ),
                h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, lastBracket),
            ];
        }
    }
    else {
        return [
            ...firstBracket,
            ...token.children.reduce((acc: VNode[], to: Token) => {
                // Original passed `className` here too but receivers read
                // `outerClass` — see PR note above.
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
                token.backlash.first,
                className,
                firstBacklashStart,
                token,
            ),
            ...middleHref,
            ...this.backlashInToken(
                h,
                token.backlash.second,
                className,
                secondBacklashStart,
                token,
            ),
            ...lastBracket,
        ];
    }
}
