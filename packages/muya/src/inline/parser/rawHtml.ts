import type { HTMLTagToken } from '../model/types';
import { VOID_HTML_TAGS } from '../../config';
import { matchAt } from './matchAt';

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

const voidTags = new Set<string>(VOID_HTML_TAGS);

interface IHtmlMatch {
    raw: string;
    tag: string;
    kind: NonNullable<HTMLTagToken['kind']>;
    openTag: string;
    closeTag?: string;
    content?: string;
}

interface IHtmlClose {
    start: number;
    end: number;
}

function tagName(raw: string): string | undefined {
    return /^<\/?([A-Z][A-Z\d-]*)/i.exec(raw)?.[1].toLowerCase();
}

/** Paired tags are a display convenience; recognition and precedence remain atomic. */
export class HtmlTagScanner {
    private _closers = new Map<number, IHtmlClose>();
    private _indexedOpeners = new Set<number>();

    constructor(private _source: string, private _protectedEnd: (index: number) => number) {}

    read(index: number, end = this._source.length): IHtmlMatch | null {
        const match = matchAt(rawHtmlToken, this._source, index);
        if (!match || index + match[0].length > end)
            return null;
        const openTag = match[0];
        const name = tagName(openTag);
        if (!name) {
            const kind = openTag.startsWith('<!--')
                ? 'comment'
                : openTag.startsWith('<?')
                    ? 'processing-instruction'
                    : openTag.startsWith('<![CDATA[') ? 'cdata' : 'declaration';
            return { raw: openTag, openTag, tag: '<!---->', kind };
        }
        const kind = openTag.startsWith('</') ? 'closing-tag' : 'tag';
        let close: IHtmlClose | undefined;
        if (kind === 'tag' && !voidTags.has(name) && !openTag.endsWith('/>')) {
            // Outer scans skip links; their labels are indexed separately within the child source.
            if (!this._indexedOpeners.has(index))
                this._indexClosers(index, end);
            const candidate = this._closers.get(index);
            if (candidate && candidate.end <= end)
                close = candidate;
        }
        return {
            raw: close ? this._source.slice(index, close.end) : openTag,
            tag: name,
            kind,
            openTag,
            closeTag: close ? this._source.slice(close.start, close.end) : undefined,
            content: close ? this._source.slice(index + openTag.length, close.start) : undefined,
        };
    }

    private _indexClosers(index: number, end: number): void {
        const openers = new Map<string, number[]>();
        const src = this._source;
        // Index successful and unmatched openers together so missing closers cannot rescan a suffix.
        while (index < end) {
            const protectedEnd = this._protectedEnd(index);
            if (protectedEnd > index) {
                index = protectedEnd;
                continue;
            }
            const match = src[index] === '<' ? matchAt(rawHtmlToken, src, index) : null;
            if (!match || index + match[0].length > end) {
                index++;
                continue;
            }
            const raw = match[0];
            const name = tagName(raw);
            if (name && !voidTags.has(name)) {
                const stack = openers.get(name) ?? [];
                if (raw.startsWith('</')) {
                    const opener = stack.pop();
                    if (opener !== undefined)
                        this._closers.set(opener, { start: index, end: index + raw.length });
                }
                else if (!raw.endsWith('/>')) {
                    this._indexedOpeners.add(index);
                    stack.push(index);
                    openers.set(name, stack);
                }
            }
            index += raw.length;
        }
    }
}
