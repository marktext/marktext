import type { Token as HtmlToken } from 'parse5';
import type { Labels, ReferenceImageToken, ReferenceLinkToken, Token } from '../../src/inline/model/types';
import { escapeAttribute, escapeText } from 'entities';
import { Tokenizer } from 'parse5';
import { VOID_HTML_TAGS } from '../../src/config';
import { normalizeReferenceLabel } from '../../src/inline/referenceLabel';

export type SemanticEvent
    = | { type: 'open'; tag: string; attrs: Array<[string, string]>; selfClosing?: true }
        | { type: 'close'; tag: string }
        | { type: 'text'; value: string }
        | { type: 'softbreak' | 'hardbreak' }
        | { type: 'comment'; value: string }
        | { type: 'doctype'; name: string | null; publicId: string | null; systemId: string | null };

const VOID_TAGS = new Set<string>(VOID_HTML_TAGS);
const BLOCK_TAG = /^(?:p|h[1-6])$/;

function canonicalUrl(value: string): string {
    try {
        // CommonMark permits renderers to percent-encode URLs. Keep encoded reserved characters distinct.
        return encodeURI(value).replace(/%25([\da-f]{2})/gi, '%$1').replace(/%[\da-f]{2}/gi, escape => escape.toUpperCase());
    }
    catch {
        return value;
    }
}

/** Token events preserve unmatched/nested tags that a browser's tree builder would repair. */
export function htmlSemantics(html: string): SemanticEvent[] {
    const events: SemanticEvent[] = [];
    let blockDepth = 0;
    let codeDepth = 0;
    let afterHardBreak = false;

    const text = ({ chars }: HtmlToken.CharacterToken) => {
        if (blockDepth === 0 && /^[\t\n\r ]*$/.test(chars))
            return;
        let value = chars;
        if (afterHardBreak && value.startsWith('\n'))
            value = value.slice(1);
        afterHardBreak = false;
        for (const part of codeDepth ? [value] : value.split(/(\n)/)) {
            if (!part)
                continue;
            if (!codeDepth && part === '\n') {
                events.push({ type: 'softbreak' });
            }
            else {
                const previous = events.at(-1);
                if (previous?.type === 'text')
                    previous.value += part;
                else
                    events.push({ type: 'text', value: part });
            }
        }
    };

    const tokenizer = new Tokenizer({}, {
        onCharacter: text,
        onWhitespaceCharacter: text,
        onNullCharacter: text,
        onStartTag(token) {
            if (token.tagName === 'br') {
                events.push({ type: 'hardbreak' });
                afterHardBreak = true;
                return;
            }
            afterHardBreak = false;
            if (BLOCK_TAG.test(token.tagName))
                blockDepth++;
            if (token.tagName === 'code')
                codeDepth++;
            const attrs: Array<[string, string]> = token.attrs.map(({ name, value }) => [
                name,
                name === 'href' || name === 'src' ? canonicalUrl(value) : value,
            ]);
            attrs.sort(([a], [b]) => a.localeCompare(b));
            const event: SemanticEvent = { type: 'open', tag: token.tagName, attrs };
            if (token.selfClosing && !VOID_TAGS.has(token.tagName))
                event.selfClosing = true;
            events.push(event);
        },
        onEndTag(token) {
            events.push({ type: 'close', tag: token.tagName });
            if (BLOCK_TAG.test(token.tagName))
                blockDepth = Math.max(0, blockDepth - 1);
            if (token.tagName === 'code')
                codeDepth = Math.max(0, codeDepth - 1);
            afterHardBreak = false;
        },
        onComment(token) {
            afterHardBreak = false;
            events.push({ type: 'comment', value: token.data });
        },
        onDoctype(token) {
            afterHardBreak = false;
            events.push({ type: 'doctype', name: token.name, publicId: token.publicId, systemId: token.systemId });
        },
        onEof() {},
    });
    tokenizer.write(html, true);
    return events;
}

function attribute(name: string, value: string): string {
    return ` ${name}="${escapeAttribute(value)}"`;
}

function link(href: string, title: string, content: string): string {
    return `<a${attribute('href', href)}${title ? attribute('title', title) : ''}>${content}</a>`;
}

function image(src: string, title: string, alt: string): string {
    return `<img${attribute('src', src)}${attribute('alt', alt)}${title ? attribute('title', title) : ''} />`;
}

function referenceHtml(token: ReferenceLinkToken | ReferenceImageToken, labels: Labels, children: string): string {
    const definition = labels.get(normalizeReferenceLabel(token.label + token.backlash.second));
    if (!definition)
        throw new Error(`Unresolved reference token: ${token.raw}`);
    return token.type === 'reference_link'
        ? link(definition.href, definition.title, children)
        : image(definition.href, definition.title, token.attrs.alt);
}

function leafHtml(token: Token, literalExtensions: boolean): string | undefined {
    switch (token.type) {
        case 'text':
            return escapeText(token.content);
        case 'backlash':
            return escapeText(token.raw.slice(token.marker.length));
        case 'html_escape':
            return escapeText(token.content);
        case 'inline_code':
            return `<code>${escapeText(token.content)}</code>`;
        case 'soft_line_break':
            return token.lineBreak;
        case 'hard_line_break':
            return '<br />\n';
        case 'auto_link':
            return link(token.isLink ? token.href : `mailto:${token.email}`, '', escapeText(token.raw.slice(1, -1)));
        case 'auto_link_extension':
            return literalExtensions ? escapeText(token.raw) : link(token.www ? `http://${token.www}` : token.url || `mailto:${token.email}`, '', escapeText(token.raw));
        case 'emoji':
            // The lexer has no switch for emoji; project it literally only when classifying extension differences.
            return literalExtensions ? escapeText(token.raw) : `<muya-emoji${attribute('name', token.content)}></muya-emoji>`;
    }
}

/** Only lexer-provided values are rendered here; decoding/normalizing them would hide lexer defects. */
export function tokensToHtml(tokens: Token[], labels: Labels, literalExtensions = false): string {
    return tokens.map((token): string => {
        const leaf = leafHtml(token, literalExtensions);
        if (leaf !== undefined)
            return leaf;
        const children = 'children' in token && token.children
            ? tokensToHtml(token.children, labels, literalExtensions)
            : '';
        switch (token.type) {
            case 'strong':
            case 'em':
                return `<${token.type}>${children}</${token.type}>`;
            case 'del':
                return literalExtensions ? escapeText(token.marker) + children + escapeText(token.marker) : `<del>${children}</del>`;
            case 'link':
                return link(token.href, token.title, children);
            case 'image':
                return image(token.attrs.src, token.title, token.attrs.alt);
            case 'reference_link':
            case 'reference_image':
                return referenceHtml(token, labels, children);
            case 'html_tag':
                // Rebuilding valid tags here would hide malformed source; parsed fields have a separate audit.
                return token.closeTag && token.children ? token.openTag + children + token.closeTag : token.raw;
            default:
                throw new Error(`Unadapted lexer token: ${token.type}`);
        }
    }).join('');
}
