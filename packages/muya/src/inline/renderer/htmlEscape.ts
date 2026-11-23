import type { HTMLEscapeToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';

export default function htmlEscape(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: HTMLEscapeToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { start, end } = token.range;
    // The wrapper paints the visible glyph while the marker retains source offsets.
    const glyphHighlight = this.environment.readOnly && token.highlights?.length
        ? `.${this.getHighlightClassName(token.highlights.some(highlight => highlight.active))}`
        : '';
    const content = glyphHighlight ? token.raw : this.highlight(h, block, start, end, token);

    return [
        h(
            `span.${className}.${CLASS_NAMES.MU_HTML_ESCAPE}${glyphHighlight}`,
            {
                dataset: {
                    character: token.content,
                },
            },
            h(`span.${CLASS_NAMES.MU_HTML_ESCAPE_MARKER}`, content),
        ),
    ];
}
