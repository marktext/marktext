import type { Lexer, MarkedExtension, Tokens } from 'marked';
import type { IListMarker, ListDelimiter, ListStyle } from '../../listMarker';
import { minSpacesAfterMarker, parseListMarker } from '../../listMarker';

// pandoc's `fancy_lists`: ordered lists marked `a.`, `IV)`, `(1)` and so on.
// Lists that open with a decimal `1.` or `1)` marker stay with marked's own
// tokenizer.

export interface IFancyListToken extends Tokens.List {
    style: ListStyle;
    delimiter: ListDelimiter;
}

interface IMarkerLine {
    marker: IListMarker;
    // Column where the item text starts, counted from the line start.
    contentColumn: number;
    text: string;
}

const MARKER_LINE = /^( {0,3})(\([A-Z\d]+\)|[A-Z\d]+[.)])(?:([ \t]+)([^ \t\n][^\n]*)?)?$/i;
const BULLET_OR_DECIMAL_START = /^ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|$)/;
// pandoc reads `p. 5` as a page reference, not as item sixteen.
const PAGE_REFERENCE = /^ {0,3}p\.[ \t]\d/;

function expandLeadingTabs(line: string) {
    return line.replace(/^[ \t]+/, whitespace => whitespace.replace(/\t/g, '    '));
}

function readMarkerLine(line: string, continueStyle?: ListStyle): IMarkerLine | null {
    const match = MARKER_LINE.exec(expandLeadingTabs(line));
    if (!match || PAGE_REFERENCE.test(line))
        return null;
    const [, lead, markerText, spaces = '', text = ''] = match;
    const marker = parseListMarker(markerText, continueStyle);
    if (!marker)
        return null;
    const gap = spaces.replace(/\t/g, '    ').length;
    if (text && gap < minSpacesAfterMarker(marker))
        return null;
    // Like marked: a blank first line or a code-indented text sits one column
    // past the marker.
    const textOffset = !text || gap > 4 ? 1 : gap;

    return {
        marker,
        contentColumn: lead.length + markerText.length + textOffset,
        text: gap > 4 ? `${spaces.slice(1)}${text}` : text,
    };
}

// Whether `line` opens any list item (bullet, decimal or fancy) at an indent
// that ends an item whose text starts at `contentColumn`. Same indent rule as
// marked's `nextBulletRegex`.
function startsListItem(line: string, contentColumn: number) {
    const maxIndent = Math.max(0, Math.min(3, contentColumn - 1));
    if (expandLeadingTabs(line).search(/[^ ]|$/) > maxIndent)
        return false;

    return BULLET_OR_DECIMAL_START.test(line) || readMarkerLine(line) !== null;
}

// marked's built-in list tokenizer only calls `.test` on the regex that ends
// an item at the next bullet. Overriding `test` lets a decimal or bullet item
// end at a fancy marker too, as it does in pandoc.
class ListItemStart extends RegExp {
    constructor(private _contentColumn: number) {
        super('');
    }

    override test(line: string) {
        return startsListItem(line, this._contentColumn);
    }
}

// The lexer constructor always sets `options.tokenizer`.
function tokenizerOf(lexer: Lexer) {
    return lexer.options.tokenizer!;
}

export function endListItemsAtFancyMarkers(lexer: Lexer) {
    const tokenizer = tokenizerOf(lexer);
    const { rules } = tokenizer;
    tokenizer.rules = {
        ...rules,
        other: {
            ...rules.other,
            nextBulletRegex: (contentColumn: number) => new ListItemStart(contentColumn),
        },
    };
}

function endsItem(lexer: Lexer, line: string, contentColumn: number) {
    const { other } = tokenizerOf(lexer).rules;

    return other.fencesBeginRegex(contentColumn).test(line)
        || other.headingBeginRegex(contentColumn).test(line)
        || other.htmlBeginRegex(contentColumn).test(line)
        || other.blockquoteBeginRegex(contentColumn).test(line)
        || other.hrRegex(contentColumn).test(line)
        || startsListItem(line, contentColumn);
}

// A lazy line continues a paragraph, so it cannot follow other block starts.
function endsParagraph(lexer: Lexer, line: string, contentColumn: number) {
    const { other } = tokenizerOf(lexer).rules;

    return expandLeadingTabs(line).search(/\S/) >= 4
        || other.fencesBeginRegex(contentColumn).test(line)
        || other.headingBeginRegex(contentColumn).test(line)
        || other.hrRegex(contentColumn).test(line);
}

function nextLine(src: string) {
    return src.split('\n', 1)[0];
}

interface IItemBody {
    raw: string;
    text: string;
}

// The lines of one item: its marker line, then indented lines (dedented by
// the content column) and lazy paragraph lines, up to the next block that
// ends it. Mirrors marked's list tokenizer.
function readItemBody(lexer: Lexer, src: string, head: IMarkerLine): IItemBody {
    const { contentColumn } = head;
    let rest = src.slice(nextLine(src).length + 1);
    let raw = `${nextLine(src)}\n`;
    let text = head.text;
    let blankLine = !head.text.trim();
    let previous = head.text;

    if (blankLine && rest && !nextLine(rest).trim()) {
        return { raw: `${raw}${nextLine(rest)}\n`, text };
    }

    while (rest) {
        const line = nextLine(rest);
        if (endsItem(lexer, line, contentColumn))
            break;
        const expanded = expandLeadingTabs(line);
        if (!line.trim() || expanded.search(/\S/) >= contentColumn) {
            text += `\n${expanded.slice(contentColumn)}`;
        }
        else {
            if (blankLine || endsParagraph(lexer, previous, contentColumn))
                break;
            text += `\n${line}`;
        }
        blankLine = !line.trim();
        previous = expanded.slice(contentColumn);
        raw += `${line}\n`;
        rest = rest.slice(line.length + 1);
    }

    return { raw, text };
}

function tokenizeFancyList(lexer: Lexer, src: string): IFancyListToken | undefined {
    const first = readMarkerLine(nextLine(src));
    if (!first)
        return;
    const { value, style, delimiter } = first.marker;
    if (style === 'decimal' && delimiter !== '()')
        return;
    // A nested list has to start at one (or `a`, `i`), so a parenthesised
    // date inside an item stays text.
    if (!lexer.state.top && value !== 1)
        return;

    const { other } = tokenizerOf(lexer).rules;
    const list: IFancyListToken = {
        type: 'list',
        raw: '',
        ordered: true,
        start: value,
        loose: false,
        items: [],
        style,
        delimiter,
    };
    let rest = src;
    let endsWithBlankLine = false;
    while (rest) {
        const head = readMarkerLine(nextLine(rest), style);
        if (!head || head.marker.delimiter !== delimiter)
            break;
        const { raw, text } = readItemBody(lexer, rest, head);
        if (!list.loose) {
            if (endsWithBlankLine)
                list.loose = true;
            else if (other.doubleBlankLine.test(raw))
                endsWithBlankLine = true;
        }
        list.items.push({ type: 'list_item', raw, task: false, loose: false, text, tokens: [] });
        list.raw += raw;
        rest = rest.slice(raw.length);
    }

    const last = list.items[list.items.length - 1];
    last.raw = last.raw.trimEnd();
    last.text = last.text.trimEnd();
    list.raw = list.raw.trimEnd();

    for (const item of list.items) {
        lexer.state.top = false;
        item.tokens = lexer.blockTokens(item.text, []);
        if (!list.loose)
            list.loose = item.tokens.some(token => token.type === 'space' && other.anyLine.test(token.raw));
    }
    for (const item of list.items)
        item.loose = list.loose;

    return list;
}

export default function fancyListsExtension(): MarkedExtension {
    return {
        extensions: [{
            name: 'fancyList',
            level: 'block',
            tokenizer(src: string) {
                return tokenizeFancyList(this.lexer, src);
            },
        }],
    };
}
