import type { VNode } from 'snabbdom';
import type { HTMLTagToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { DecodingMode, EntityDecoder, htmlDecodeTree } from 'entities/decode';
import { CLASS_NAMES } from '../../config';
import { htmlToVNode } from '../../utils/snabbdom';
import { matchAt } from '../parser/matchAt';
import { rawHtmlToken } from '../parser/rawHtml';
import { renderCharacter } from './htmlEscape';
import { readingBreak } from './lineBreakHighlights';

/**
 * Let the HTML parser build the ruby tree (including implied rt/rp end tags).
 * Comment slots preserve Muya's source ranges without introducing layout boxes during parsing.
 */
export function readingRuby(renderer: Renderer, options: ISyntaxRenderOptions & { token: HTMLTagToken }): VNode {
    const { h, token, block } = options;
    const { raw, range } = token;
    const slots: VNode[] = [];
    const markup: string[] = [];
    const slot = (node: VNode) => {
        markup.push(`<!--${slots.length}-->`);
        slots.push(node);
    };
    let glyph = '';
    const decoder = new EntityDecoder(htmlDecodeTree, (code) => {
        glyph += String.fromCodePoint(code);
    });
    const parts = /[^<&]+|[<&]/gy;
    for (let index = 0; index < raw.length;) {
        const start = range.start + index;
        const tag = raw[index] === '<' ? matchAt(rawHtmlToken, raw, index)?.[0] : undefined;
        if (tag) {
            slot(h('span', { attrs: { hidden: true } }, tag));
            if (/^<br(?=[\s/>])/i.test(tag))
                slot(readingBreak(renderer, h, token, start, start + tag.length));
            else if (/^<\/?[a-z]/i.test(tag))
                markup.push(tag.replace(/^<([\w-]+)/, `<$1 data-start="${start}"`));
            index += tag.length;
            continue;
        }
        if (raw[index] === '&') {
            glyph = '';
            decoder.startEntity(DecodingMode.Legacy);
            let length = decoder.write(raw, index + 1);
            if (length < 0)
                length = decoder.end();
            if (length) {
                const end = start + length;
                slot(renderCharacter(renderer, options, CLASS_NAMES.MU_HIDE, glyph, CLASS_NAMES.MU_HTML_ESCAPE, { start, end }));
                index += length;
                continue;
            }
        }
        parts.lastIndex = index;
        const text = parts.exec(raw)![0];
        slot(h('span', renderer.highlight(h, block, start, start + text.length, token)));
        index += text.length;
    }

    const root = h('span', htmlToVNode(markup.join('')));
    const pending = [root];
    while (pending.length) {
        const node = pending.pop()!;
        if (node.data?.dataset?.start !== undefined)
            node.sel += `.${CLASS_NAMES.MU_RAW_HTML}`;
        const children = node.children ?? [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (typeof child === 'string')
                continue;
            if (child.sel === '!')
                children[i] = slots[Number(child.text)] ?? child;
            else
                pending.push(child);
        }
    }
    return root;
}
