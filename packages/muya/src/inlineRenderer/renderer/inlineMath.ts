import type { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import katex from 'katex';
import { CLASS_NAMES } from '../../config';
import { htmlToVNode } from '../../utils/snabbdom';
import 'katex/dist/contrib/mhchem.mjs';

import 'katex/dist/katex.min.css';

export default function inlineMath(this: Renderer, {
    h,
    cursor,
    block,
    token,
    outerClass,
}: ISyntaxRenderOptions & { token: CodeEmojiMathToken }) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { i18n } = this.muya;
    const mathSelector
        = className === CLASS_NAMES.MU_HIDE
            ? `span.${className}.${CLASS_NAMES.MU_MATH}`
            : `span.${CLASS_NAMES.MU_MATH}`;

    const { start, end } = token.range;
    const { marker } = token;

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

    const displayMode = false;
    const key = `${math}_${type}`;
    let mathVnode = null;
    let previewSelector = `span.${CLASS_NAMES.MU_MATH_RENDER}`;
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
        catch {
            mathVnode = `<${i18n.t('Invalid Mathematical Formula')}>`;
            previewSelector += `.${CLASS_NAMES.MU_MATH_ERROR}`;
        }
    }

    return [
        h(`span.${className}.${CLASS_NAMES.MU_MATH_MARKER}`, startMarker),
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
                    attrs: { contenteditable: 'false' },
                    dataset: {
                        start: String(start + 1), // '$'.length
                        end: String(end - 1), // '$'.length
                    },
                },
                mathVnode,
            ),
        ]),
        h(`span.${className}.${CLASS_NAMES.MU_MATH_MARKER}`, endMarker),
    ];
}
