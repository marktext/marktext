import type { VNode } from 'snabbdom';
import type { HTMLTagToken } from '../model/types';
import type Renderer from './index';
import type { H, IContainerRenderOptions } from './types';
import { BLOCK_TYPE6, CLASS_NAMES } from '../../config';
import sanitize, { isValidAttribute } from '../../utils/dompurify';

function renderHtmlTagChildren(
    token: HTMLTagToken,
    childNodes: IContainerRenderOptions['childNodes'],
): (VNode | string)[] | '' {
    const { tag, children } = token;

    return Array.isArray(children) && children.length && tag !== 'ruby'
        ? childNodes(children)
        : '';
}

function buildRawHtmlTag(
    token: HTMLTagToken,
    tagClassName: string,
    openContent: (string | VNode)[],
    closeContent: (string | VNode)[] | '',
    anchor: (VNode | string)[] | '',
    h: H,
): (VNode | string)[] {
    const { tag, attrs } = token;
    const { start, end } = token.range;

    // if  tag is a block level element, use a inline element `span` to instead.
    // Because we can not nest a block level element in span element(line is span element)
    // we also recommend user not use block level element in paragraph. use block element in html block.
    // Use code !sanitize(`<${tag}>`) to filter some malicious tags. for example: <embed>.
    let selector
        = BLOCK_TYPE6.includes(tag) || !sanitize(`<${tag}>`) ? 'span' : tag;
    selector += `.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_RAW_HTML}`;
    const data = {
        attrs: {} as Record<string, string>,
        dataset: {
            start: String(start),
            end: String(end),
            // Link tools need anchor source; copying every wrapper would make nested output quadratic.
            ...(tag === 'a' ? { raw: token.raw } : {}),
        },
    };

    // Disable spell checking for these tags
    if (tag === 'code' || tag === 'kbd')
        Object.assign(data.attrs, { spellcheck: 'false' });

    // Not in the selector: its parser truncates an id at `.`, `/` or a space (#5419).
    if (attrs.id)
        data.attrs.id = attrs.id;

    if (attrs.class && /\S/.test(attrs.class)) {
        const classNames = attrs.class.split(/\s+/);

        for (const className of classNames)
            selector += `.${className}`;
    }

    for (const attr of Object.keys(attrs)) {
        if (attr !== 'id' && attr !== 'class') {
            const attrData = attrs[attr];
            if (attrData && isValidAttribute(tag, attr, attrData))
                data.attrs[attr] = attrData;
        }
    }

    return [
        h(
            `span.${tagClassName}.${CLASS_NAMES.MU_OUTPUT_REMOVE}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            openContent,
        ),
        h(`${selector}`, data, anchor),
        h(
            `span.${tagClassName}.${CLASS_NAMES.MU_OUTPUT_REMOVE}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            closeContent,
        ),
    ];
}

export function isLiteralHtml(token: HTMLTagToken): boolean {
    return !!(token.kind && token.kind !== 'tag') || /^(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)$/i.test(token.tag);
}

export default function htmlTag(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
        childNodes,
    }: IContainerRenderOptions & { token: HTMLTagToken },
) {
    const { tag, openTag, closeTag, children } = token;

    // `<br>` is a void tag, but its marker still hides with the cursor.
    const className = children?.length || tag === 'br'
        ? this.getClassName(outerClass, block, token, cursor)
        : CLASS_NAMES.MU_GRAY;
    const tagClassName
        = className === CLASS_NAMES.MU_HIDE ? className : CLASS_NAMES.MU_HTML_TAG;
    const { start, end } = token.range;
    const openContent = this.highlight(
        h,
        block,
        start,
        start + openTag.length,
        token,
    );
    const closeContent = closeTag
        ? this.highlight(h, block, end - closeTag.length, end, token)
        : '';

    if (isLiteralHtml(token)) {
        return [h(`span.${CLASS_NAMES.MU_HTML_TAG}`, this.highlight(h, block, start, end, token))];
    }

    const anchor = renderHtmlTagChildren(token, childNodes);

    switch (tag) {
        case 'img': {
            return this.image({
                h,
                cursor,
                block,
                token: {
                    ...token,
                    tag,
                    kind: 'tag',
                },
                outerClass,
            });
        }

        case 'br': {
            // Keep the real `<br>` outside the marker so hiding the marker keeps the line break.
            return [
                h(`span.${CLASS_NAMES.MU_HTML_TAG}`, [
                    h(
                        `span.${tagClassName}.${CLASS_NAMES.MU_OUTPUT_REMOVE}`,
                        {
                            attrs: {
                                spellcheck: 'false',
                            },
                        },
                        openContent,
                    ),
                    h(tag),
                ]),
            ];
        }

        default:
            // handle void html tag
            if (!closeTag) {
                return [h(`span.${CLASS_NAMES.MU_HTML_TAG}`, openContent)];
            }
            else if (tag === 'ruby') {
                return this.htmlRuby({
                    h,
                    cursor,
                    block,
                    token,
                    outerClass,
                });
            }
            else {
                return buildRawHtmlTag(
                    token,
                    tagClassName,
                    openContent,
                    closeContent,
                    anchor,
                    h,
                );
            }
    }
}
