import type { HTMLTagToken } from './types';
import { CodeSpanScanner } from './codeSpan';

const htmlSpace = /[ \t]*(?:(?:\r\n?|\n)[ \t]*)?/.source;
const htmlTagName = /[A-Za-z][A-Za-z\d-]*/.source;
const htmlAttributeName = /[A-Za-z_:][\w.:-]*/.source;
const htmlAttributeValue = /(?:"[^"]*"|'[^']*'|[^ \t\r\n"'=<>`]+)/.source;
const htmlAttribute = `(?=[ \\t\\r\\n])${htmlSpace}${htmlAttributeName}(?:${htmlSpace}=${htmlSpace}${htmlAttributeValue})?`;

// CommonMark §6.6: quotes own their contents; whitespace must separate attributes.
const htmlTokenPattern = [
    `<${htmlTagName}(?:${htmlAttribute})*${htmlSpace}/?>`,
    `</${htmlTagName}${htmlSpace}>`,
    /<!--(?:>|->|[\s\S]*?-->)/.source,
    /<\?[\s\S]*?\?>/.source,
    /<![A-Za-z][^>]*>/.source,
    /<!\[CDATA\[[\s\S]*?\]\]>/.source,
].join('|');

export const rawHtmlToken = new RegExp(`^(?:${htmlTokenPattern})`);

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const htmlTokenAt = new RegExp(htmlTokenPattern, 'y');

interface IHtmlMatch {
    raw: string;
    tag: string;
    kind: NonNullable<HTMLTagToken['kind']>;
    openTag: string;
    closeTag?: string;
    content?: string;
}

function matchingClose(src: string, start: number, tag: string, codeSpans?: CodeSpanScanner): { start: number; end: number } | undefined {
    let depth = 1;
    let index = start;
    while (index < src.length) {
        if (src[index] === '\\') {
            index += 2;
            continue;
        }
        if (src[index] === '`') {
            codeSpans ??= new CodeSpanScanner(src);
            index = codeSpans!.read(index)!.end;
            continue;
        }
        htmlTokenAt.lastIndex = index;
        const match = src[index] === '<' ? htmlTokenAt.exec(src) : null;
        if (!match) {
            index++;
            continue;
        }
        const name = /^<\/?([A-Z][A-Z\d-]*)/i.exec(match[0])?.[1].toLowerCase();
        if (name === tag) {
            if (match[0].startsWith('</'))
                depth--;
            else if (!match[0].endsWith('/>'))
                depth++;
            if (depth === 0)
                return { start: index, end: index + match[0].length };
        }
        index += match[0].length;
    }
}

/** Offsets and the optional shared code-span index refer to the complete tokenizer source. */
export function matchHtmlTag(src: string, index = 0, codeSpans?: CodeSpanScanner): IHtmlMatch | null {
    htmlTokenAt.lastIndex = index;
    const match = htmlTokenAt.exec(src);
    if (!match)
        return null;

    const openTag = match[0];
    const name = /^<\/?([A-Z][A-Z\d-]*)/i.exec(openTag)?.[1].toLowerCase();
    if (!name) {
        const kind = openTag.startsWith('<!--')
            ? 'comment'
            : openTag.startsWith('<?')
                ? 'processing-instruction'
                : openTag.startsWith('<![CDATA[') ? 'cdata' : 'declaration';
        return { raw: openTag, openTag, tag: '<!---->', kind };
    }
    const kind = openTag.startsWith('</') ? 'closing-tag' : 'tag';
    const close = kind === 'tag' && !VOID_TAGS.has(name) && !openTag.endsWith('/>')
        ? matchingClose(src, index + openTag.length, name, codeSpans)
        : undefined;

    // Paired tags are a rendering convenience; recognition and precedence use atomic tokens.
    return {
        raw: close ? src.slice(index, close.end) : openTag,
        tag: name,
        kind,
        openTag,
        closeTag: close ? src.slice(close.start, close.end) : undefined,
        content: close ? src.slice(index + openTag.length, close.start) : undefined,
    };
}
