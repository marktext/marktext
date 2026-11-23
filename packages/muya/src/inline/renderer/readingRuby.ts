import type { VNode } from 'snabbdom';
import type { HTMLTagToken } from '../model/types';
import type { IReadingSpan } from '../readingText';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { DecodingMode, EntityDecoder, htmlDecodeTree } from 'entities/decode';
import { CLASS_NAMES } from '../../config';
import { htmlToVNode } from '../../utils/snabbdom';
import { intersectingHighlights } from '../model/ranges';
import { matchAt } from '../parser/matchAt';
import { rawHtmlToken } from '../parser/rawHtml';
import { renderCharacter } from './htmlEscape';
import { readingBreak } from './lineBreakHighlights';

const textOnlyOpener = /^<(textarea|title|style|xmp|iframe|noembed|noframes|noscript|script|plaintext)(?=[\s/>])/i;

function readEntity(source: string, index: number) {
    let text = '';
    const decoder = new EntityDecoder(htmlDecodeTree, (code) => {
        text += String.fromCodePoint(code);
    });
    decoder.startEntity(DecodingMode.Legacy);
    let length = decoder.write(source, index + 1);
    if (length < 0)
        length = decoder.end();
    return { text, length };
}

function nativeTextSpans(name: string, body: string, start: number): IReadingSpan[] {
    const spans: IReadingSpan[] = [];
    const decode = name === 'textarea' || name === 'title';
    const parts = decode ? /[^&\r]+|[&\r]/gy : /[^\r]+|\r/gy;
    const leadingBreak = name === 'textarea' ? /^(?:\r\n?|\n)/.exec(body)?.[0] : '';
    for (let offset = leadingBreak?.length ?? 0; offset < body.length;) {
        parts.lastIndex = offset;
        const part = parts.exec(body)![0];
        const entity = decode && part === '&' ? readEntity(body, offset) : undefined;
        const newline = part === '\r';
        const text = entity?.text || (newline ? '\n' : part);
        const length = entity?.length || (newline && body[offset + 1] === '\n' ? 2 : part.length);
        spans.push({ text, start: start + offset, end: start + offset + length });
        offset += length;
    }
    return spans;
}

// The browser parses these bodies as text. Find can mark the element, but inserting
// highlight spans or comment slots inside it would change the displayed value.
function nativeTextElement(renderer: Renderer, { h, token }: ISyntaxRenderOptions, name: string, index: number, openTag: string) {
    const { raw, range } = token;
    const close = new RegExp(`</${name}(?=[\\s/>])[^>]*>`, 'gi');
    close.lastIndex = index + openTag.length;
    const endTag = name === 'plaintext' ? null : close.exec(raw);
    const end = endTag ? close.lastIndex : raw.length;
    const source = raw.slice(index, end);
    const body = raw.slice(index + openTag.length, endTag?.index);
    const start = range.start + index + openTag.length;
    const element = htmlToVNode(source)![0] as VNode;
    element.sel += `.${CLASS_NAMES.MU_RAW_HTML}.${CLASS_NAMES.MU_RUBY_RENDER}`;
    element.data!.dataset = { ...element.data!.dataset, start: String(range.start + index) };
    const hits = intersectingHighlights({ start, end: start + body.length }, token.highlights ?? []);
    if (hits.length)
        element.sel += `.${renderer.getHighlightClassName(hits.some(hit => hit.active))}`;
    const html = (element.elm as HTMLElement).innerHTML;
    element.data!.props = { innerHTML: name === 'textarea' && html.startsWith('\n') ? `\n${html}` : html };
    renderer.reading?.mark(element, name === 'iframe'
        ? { text: '', object: true, start: range.start + index, end: range.start + end }
        : nativeTextSpans(name, body, start));
    return { end, node: h('span', [h('span', { attrs: { hidden: true } }, source), element]) };
}

// Like a rendered Markdown image, an image is a Find boundary rather than text.
// It has no end tag, so a slot leaves the parsed ruby structure unchanged.
function readingImage(renderer: Renderer, tag: string, start: number): VNode {
    const image = htmlToVNode(tag)![0] as VNode;
    image.sel += `.${CLASS_NAMES.MU_RAW_HTML}`;
    image.data = { ...image.data, dataset: { ...image.data?.dataset, start: String(start) } };
    return renderer.reading?.mark(image, { text: '', object: true, start, end: start + tag.length }) ?? image;
}

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
    const parts = /[^<&]+|[<&]/gy;
    for (let index = 0; index < raw.length;) {
        const start = range.start + index;
        const tag = raw[index] === '<' ? matchAt(rawHtmlToken, raw, index)?.[0] : undefined;
        if (tag) {
            const literal = textOnlyOpener.exec(tag);
            if (literal) {
                const { node, end } = nativeTextElement(renderer, options, literal[1].toLowerCase(), index, tag);
                slot(node);
                index = end;
                continue;
            }
            slot(h('span', { attrs: { hidden: true } }, tag));
            if (/^<br(?=[\s/>])/i.test(tag))
                slot(readingBreak(renderer, h, token, start, start + tag.length));
            else if (/^<img(?=[\s/>])/i.test(tag))
                slot(readingImage(renderer, tag, start));
            else if (/^<\/?[a-z]/i.test(tag))
                markup.push(tag.replace(/^<([\w-]+)/, `<$1 data-start="${start}"`));
            index += tag.length;
            continue;
        }
        if (raw[index] === '&') {
            const { text: glyph, length } = readEntity(raw, index);
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
