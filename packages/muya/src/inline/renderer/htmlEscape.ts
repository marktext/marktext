import type { HTMLEscapeToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { intersectingHighlights } from '../model/ranges';
import { renderedText } from '../readingText';

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
    return [renderCharacter(this, { h, block, token }, className, token.content, CLASS_NAMES.MU_HTML_ESCAPE)];
}

export function renderCharacter(
    renderer: Renderer,
    { h, block, token }: Pick<ISyntaxRenderOptions, 'h' | 'block' | 'token'>,
    className: string,
    character: string,
    syntax: string,
    range = token.range,
) {
    const { start, end } = range;
    const matches = renderer.environment.readOnly ? intersectingHighlights(range, token.highlights ?? []) : [];
    const highlight = matches.length
        ? `.${renderer.getHighlightClassName(matches.some(light => light.active))}`
        : '';
    const source = highlight ? block.text.slice(start, end) : renderer.highlight(h, block, start, end, token);
    const node = h(`span.${className}.${syntax}.mu-rendered-character${highlight}`, {
        dataset: { character },
    }, h(`span.${CLASS_NAMES.MU_HTML_ESCAPE_MARKER}`, source));
    return renderedText(renderer, character, start, end, node);
}
