import type { ICodeSpanMatch, ICodeSpanReader } from './codeSpan';
import type { Rules } from './types';
import { decodeHTMLAttribute } from 'entities';
import { CodeSpanScanner } from './codeSpan';
import { matchAt } from './matchAt';

const AUTO_LINK_BOUNDARY = /[* _~(]/;

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
    // Used in img
    'data-align',
];

function validWidthAndHeight(value: string) {
    if (!/^\d+$/.test(value))
        return '';
    const num = Number.parseInt(value);

    return num >= 0 ? num.toString() : '';
}

export function lowerPriority(src: string, offset: number, rules: Rules, start = 0, codeSpans?: ICodeSpanReader) {
    let i;
    const patterns = Object.values(rules);

    for (i = start; i < offset; i++) {
        // A character preceded by an odd number of backslashes is escaped
        // (e.g. `\$`), so it cannot open a higher-priority construct such as
        // inline math/code and must not lower the surrounding emphasis.
        let backslashes = 0;
        for (let j = i - 1; j >= 0 && src[j] === '\\'; j--)
            backslashes++;
        if (backslashes % 2 === 1)
            continue;

        const text = src.substring(i);

        if (text[0] === '`') {
            codeSpans ??= new CodeSpanScanner(src);
            const code: ICodeSpanMatch = codeSpans.read(i)!;
            if (code.closed && code.end > offset)
                return false;
            i = code.end - 1;
            continue;
        }

        for (const regexp of patterns) {
            const to = regexp.exec(text);
            if (to && to[0].length > offset - i)
                return false;
            if (to) {
                // Backticks and brackets inside an HTML token cannot open another construct.
                i += to[0].length - 1;
                break;
            }
        }
    }

    return true;
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

// GFM §6.9 (https://github.github.com/gfm/#autolinks-extension-): trim a
// www/url autolink's extent to drop characters that are not part of the link.
// The match is greedy (`\S+`), so these are applied after the regex, mirroring
// cmark-gfm's `autolink_delim`:
//   - a `<` ends the autolink;
//   - trailing punctuation `?!.,:*_~` is excluded (interior is kept);
//   - a trailing `)` is excluded when the link has more `)` than `(`, so an
//     autolink can sit inside parentheses;
//   - a trailing `;` closing an `&entity;`-looking reference is excluded.
// The last three rules interleave and are applied repeatedly (e.g. `).`).
export function trimAutoLinkExtent(raw: string): string {
    let end = raw.length;
    const lt = raw.indexOf('<');
    if (lt !== -1)
        end = lt;

    // Other suffix rules cannot change parentheses, so one lazy count remains valid throughout trimming.
    let excessClosingParens: number | undefined;
    let changed = true;
    while (changed && end > 0) {
        changed = false;
        const c = raw[end - 1];

        if ('?!.,:*_~'.includes(c)) {
            end -= 1;
            changed = true;
        }
        else if (c === ')') {
            if (excessClosingParens === undefined) {
                excessClosingParens = 0;
                for (let i = 0; i < end; i++) {
                    const character = raw[i];
                    if (character === '(')
                        excessClosingParens--;
                    else if (character === ')')
                        excessClosingParens++;
                }
            }
            if (excessClosingParens > 0) {
                end--;
                excessClosingParens--;
                changed = true;
            }
        }
        else if (c === ';') {
            let entityStart = end - 2;
            while (entityStart >= 0 && /[a-z0-9]/i.test(raw[entityStart]))
                entityStart -= 1;
            if (entityStart >= 0 && entityStart < end - 2 && raw[entityStart] === '&') {
                end = entityStart;
                changed = true;
            }
        }
    }

    return raw.slice(0, end);
}

export function matchExtendedAutoLink(
    pattern: RegExp,
    src: string,
    index: number,
    top: boolean,
) {
    if (!top || (index > 0 && !AUTO_LINK_BOUNDARY.test(src[index - 1])))
        return null;

    const to = matchAt(pattern, src, index);
    if (!to || to[3])
        return to;

    const trimmed = trimAutoLinkExtent(to[0]);
    if (trimmed.length !== to[0].length) {
        to[0] = trimmed;
        if (to[1])
            to[1] = trimmed;
        if (to[2])
            to[2] = trimmed;
    }

    return to;
}
