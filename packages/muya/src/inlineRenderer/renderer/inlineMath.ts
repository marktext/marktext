import type Format from '../../block/base/format';
import type { CodeEmojiMathToken, ISyntaxRenderOptions, Token } from '../types';
import type Renderer from './index';
import katex from 'katex';
import { CLASS_NAMES } from '../../config';
import { htmlToVNode } from '../../utils/snabbdom';
import 'katex/dist/contrib/mhchem.mjs';

import 'katex/dist/katex.min.css';

function isBlankOrDisplayMath(token: Token) {
    switch (token.type) {
        case 'inline_math':
            return token.marker === '$$';
        case 'text':
            return token.content.trim() === '';
        case 'soft_line_break':
        case 'hard_line_break':
            return true;
        default:
            return false;
    }
}

// Same rule as GitHub: `$$...$$` is a block only in a paragraph that holds
// nothing but such formulas, and never inside a list item.
function isDisplayMath(token: CodeEmojiMathToken, block: Format) {
    if (token.marker !== '$$' || block.blockName !== 'paragraph.content')
        return false;

    if (block.closestBlock('list-item') || block.closestBlock('task-list-item'))
        return false;

    const siblings = token.parent;
    const coversParagraph = siblings[0].range.start === 0
        && siblings[siblings.length - 1].range.end === block.text.length;

    return coversParagraph && siblings.every(isBlankOrDisplayMath);
}

export default function inlineMath(this: Renderer, {
    h,
    cursor,
    block,
    token,
    outerClass,
}: ISyntaxRenderOptions & { token: CodeEmojiMathToken }) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { i18n } = this.muya;
    const { start, end } = token.range;
    const { marker } = token;
    const displayMode = isDisplayMath(token, block);
    let mathSelector
        = className === CLASS_NAMES.MU_HIDE
            ? `span.${className}.${CLASS_NAMES.MU_MATH}`
            : `span.${CLASS_NAMES.MU_MATH}`;
    let markerSelector = `span.${className}.${CLASS_NAMES.MU_MATH_MARKER}`;
    if (displayMode) {
        mathSelector += `.${CLASS_NAMES.MU_DISPLAY_MATH}`;
        markerSelector += `.${CLASS_NAMES.MU_DISPLAY_MATH}`;
    }

    const startMarker = this.highlight(
        h,
        block,
        start,
        start + marker.length,
        token,
    );
    const endMarker = this.highlight(h, block, end - marker.length, end, token);
    const content = this.highlight(
        h,
        block,
        start + marker.length,
        end - marker.length,
        token,
    );

    const { content: math, type } = token;

    const { loadMathMap } = this;

    const key = JSON.stringify([math, type, displayMode]);
    let mathVnode = null;
    let previewSelector = `span.${CLASS_NAMES.MU_MATH_RENDER}`;
    // Inline math errors stay compact to keep the surrounding text baseline
    // (#4100, inline-math-align); surface the parse reason via the title.
    let errorTitle = '';
    if (loadMathMap.has(key)) {
        mathVnode = loadMathMap.get(key);
    }
    else {
        try {
            const html = katex.renderToString(math, {
                displayMode,
            });
            mathVnode = htmlToVNode(html);
            loadMathMap.set(key, mathVnode);
        }
        catch (err) {
            mathVnode = `<${i18n.t('Invalid Mathematical Formula')}>`;
            previewSelector += `.${CLASS_NAMES.MU_MATH_ERROR}`;
            errorTitle = err instanceof Error ? err.message : '';
        }
    }

    return [
        h(markerSelector, startMarker),
        h(mathSelector, [
            h(
                `span.${CLASS_NAMES.MU_INLINE_RULE}.${CLASS_NAMES.MU_MATH_TEXT}`,
                {
                    attrs: { spellcheck: 'false' },
                },
                content,
            ),
            h(
                previewSelector,
                {
                    attrs: errorTitle
                        ? { contenteditable: 'false', title: errorTitle }
                        : { contenteditable: 'false' },
                    dataset: {
                        start: String(start + marker.length),
                        end: String(end - marker.length),
                    },
                },
                mathVnode,
            ),
        ]),
        h(markerSelector, endMarker),
    ];
}
