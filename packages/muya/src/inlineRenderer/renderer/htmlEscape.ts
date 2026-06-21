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
    const character = escapeCharactersMap[escapeCharacter];

    const content = this.highlight(h, block, start, end, token);

    // Whitespace entities (&nbsp;, &ensp;, &emsp;) render their glyph inline so
    // the gap is exactly one space wide instead of the 1em slot reserved for a
    // visible glyph (©, ™, …).
    const escapeClass = /\s/.test(character)
        ? `${CLASS_NAMES.MU_HTML_ESCAPE}.${CLASS_NAMES.MU_HTML_ESCAPE_SPACE}`
        : CLASS_NAMES.MU_HTML_ESCAPE;

    return [
        h(
            `span.${className}.${escapeClass}`,
            {
                dataset: {
                    character,
                },
            },
            h(`span.${CLASS_NAMES.MU_HTML_ESCAPE_MARKER}`, content),
        ),
    ];
}
