import type { VNode } from 'snabbdom';
import type { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';

function codeContent(
    renderer: Renderer,
    { h, block, token }: ISyntaxRenderOptions & { token: CodeEmojiMathToken },
    syntaxClass: string,
): (VNode | string)[] {
    const start = token.range.start + token.marker.length;
    const end = token.range.end - token.marker.length;
    const source = block.text.slice(start, end);
    if (source === token.content)
        return renderer.highlight(h, block, start, end, token);

    // Keep every source character in the DOM: selection and input use UTF-16 source offsets.
    const trimmed = source.replace(/\r\n?|\n/g, ' ').length > token.content.length;
    const leading = trimmed ? /^(?:\r\n?|[\n ])/.exec(source)![0].length : 0;
    const trailing = trimmed ? /(?:\r\n|[\r\n ])$/.exec(source)![0].length : 0;
    const nodes: (VNode | string)[] = [];
    const hidden = syntaxClass === CLASS_NAMES.MU_HIDE;
    const marker = (from: number, to: number) => h(
        `span.${syntaxClass}.${CLASS_NAMES.MU_REMOVE}`,
        renderer.highlight(h, block, from, to, token),
    );
    if (leading)
        nodes.push(marker(start, start + leading));

    let pos = start + leading;
    for (const match of source.slice(leading, source.length - trailing).matchAll(/\r\n?|\n/g)) {
        const from = start + leading + match.index;
        nodes.push(...renderer.highlight(h, block, pos, from, token));
        const to = from + match[0].length;
        nodes.push(h('span.mu-code-line-break', {
            class: { 'mu-code-normalized': hidden },
        }, hidden ? [marker(from, to)] : renderer.highlight(h, block, from, to, token)));
        pos = to;
    }
    nodes.push(...renderer.highlight(h, block, pos, end - trailing, token));
    if (trailing)
        nodes.push(marker(end - trailing, end));

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
    }: ISyntaxRenderOptions & { token: CodeEmojiMathToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;
    const { start, end } = token.range;

    const startMarker = this.highlight(
        h,
        block,
        start,
        start + marker.length,
        token,
    );
    const endMarker = this.highlight(h, block, end - marker.length, end, token);
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
