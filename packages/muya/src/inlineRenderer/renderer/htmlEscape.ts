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

    const content = this.highlight(h, block, start, end, token);

    return [
        h(
            `span.${className}.${CLASS_NAMES.MU_HTML_ESCAPE}`,
            {
                dataset: {
                    character: token.content,
                },
            },
            h(`span.${CLASS_NAMES.MU_HTML_ESCAPE_MARKER}`, content),
        ),
    ];
}
