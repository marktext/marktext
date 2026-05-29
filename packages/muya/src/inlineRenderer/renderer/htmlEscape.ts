import type { HTMLEscapeToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import escapeCharactersMap from '../../config/escapeCharacter';

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
    const { escapeCharacter } = token;
    const { start, end } = token.range;

    const content = this.highlight(h, block, start, end, token);

    return [
        h(
            `span.${className}.${CLASS_NAMES.MU_HTML_ESCAPE}`,
            {
                dataset: {
                    character: escapeCharactersMap[escapeCharacter],
                },
            },
            content,
        ),
    ];
}
