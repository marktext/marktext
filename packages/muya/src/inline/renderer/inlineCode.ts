import type { VNode } from 'snabbdom';
import type { InlineCodeToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { delimitedRanges } from '../model/ranges';

function codeContent(
    renderer: Renderer,
    { h, block, token }: ISyntaxRenderOptions & { token: InlineCodeToken },
    syntaxClass: string,
): (VNode | string)[] {
    const { content: { start, end } } = delimitedRanges(token.range, token.marker.length, token.marker.length, token.contentRange);
    const source = block.text.slice(start, end);
    if (!/[\r\n]/.test(source))
        return renderer.highlight(h, block, start, end, token);

    // Keep every source character in the DOM: selection and input use UTF-16 source offsets.
    const nodes: (VNode | string)[] = [];
    const hidden = syntaxClass === CLASS_NAMES.MU_HIDE;

    let pos = start;
    for (const match of source.matchAll(/\r\n?|\n/g)) {
        const from = start + match.index;
        nodes.push(...renderer.highlight(h, block, pos, from, token));
        const to = from + match[0].length;
        nodes.push(h('span', {
            class: { [CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE]: hidden },
        }, renderer.highlight(h, block, from, to, token)));
        pos = to;
    }
    nodes.push(...renderer.highlight(h, block, pos, end, token));

    return nodes;
}

export default function inlineCode(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: InlineCodeToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;
    const { opening, closing } = delimitedRanges(token.range, marker.length, marker.length, token.contentRange);

    const startMarker = this.highlight(
        h,
        block,
        opening.start,
        opening.end,
        token,
    );
    const endMarker = this.highlight(h, block, closing.start, closing.end, token);
    const content = codeContent(this, { h, block, token, cursor }, className);

    return [
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, startMarker),
        h(
            `code.${CLASS_NAMES.MU_INLINE_RULE}`,
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
