import type { SoftLineBreakToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';

export default function softLineBreak(
    this: Renderer,
    { h, token, block, cursor, outerClass }: ISyntaxRenderOptions & { token: SoftLineBreakToken },
) {
    const { start, end } = token.range;
    let selector = `span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`;
    if (this.environment.softNewlineAsSpace) {
        selector += `.${CLASS_NAMES.MU_SOFT_NEWLINE_AS_SPACE}`;
    }
    else if (token.isAtEnd) {
        selector += `.${CLASS_NAMES.MU_LINE_END}`;
    }

    const newlineStart = start + token.raw.indexOf(token.lineBreak);
    const newlineEnd = newlineStart + token.lineBreak.length;
    const bands = this.lineBreakHighlights(h, token, newlineStart, newlineEnd);
    const nodes = [h(selector, bands.length ? [...bands, token.lineBreak] : token.lineBreak)];

    // Ignored whitespace stays in the editable DOM to preserve source offsets (§6.8).
    if (newlineStart > start || newlineEnd < end) {
        const className = this.getClassName(outerClass, block, token, cursor);
        const whitespace = (from: number, to: number) => h(
            `span.${className}.${CLASS_NAMES.MU_REMOVE}`,
            this.highlight(h, block, from, to, token),
        );
        if (newlineStart > start)
            nodes.unshift(whitespace(start, newlineStart));
        if (newlineEnd < end)
            nodes.push(whitespace(newlineEnd, end));
    }
    return nodes;
}
