import { decodeHTMLAttribute } from 'entities';

// selected from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export const WHITELIST_ATTRIBUTES = [
    'align',
    'alt',
    'checked',
    'class',
    'color',
    'dir',
    'disabled',
    'for',
    'height',
    'hidden',
    'href',
    'id',
    'lang',
    'lazyload',
    'rel',
    'spellcheck',
    'src',
    'srcset',
    'start',
    'style',
    'target',
    'title',
    'type',
    'value',
    'width',
    'data-align',
];

function validWidthAndHeight(value: string) {
    if (!/^\d+$/.test(value))
        return '';
    const num = Number.parseInt(value);

    return num >= 0 ? num.toString() : '';
}

export function getAttributes(html: string): Record<string, string> {
    const name = /^<([A-Z][A-Z\d-]*)/i.exec(html)!;
    const attrs: Record<string, string> = name[1].toLowerCase() === 'img' ? { title: '', src: '', alt: '' } : {};
    // Parse the already validated opener without a DOM tree builder dropping table/head tags.
    const attributes = /[ \t\r\n]+([A-Z_:][\w.:-]*)(?:[ \t\r\n]*=[ \t\r\n]*(?:"([^"]*)"|'([^']*)'|([^ \t\r\n"'=<>`]+)))?/gi;
    const seen = new Set<string>();
    attributes.lastIndex = name[0].length;
    for (const match of html.matchAll(attributes)) {
        const attribute = match[1].toLowerCase();
        if (!WHITELIST_ATTRIBUTES.includes(attribute) || seen.has(attribute))
            continue;
        seen.add(attribute);
        const value = decodeHTMLAttribute(match[2] ?? match[3] ?? match[4] ?? '');
        attrs[attribute] = attribute === 'width' || attribute === 'height' ? validWidthAndHeight(value) : value;
    }
    return attrs;
}
