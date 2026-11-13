import { decodeMarkdownString, isPunctuationEscape } from '../../utils/markdownEscape';

// CommonMark 0.31 §6.3: what sits between a link's `](` and its `)` is a link
// destination followed by an optional link title, not free-form text. The two
// forms of destination disagree about the space — a bare destination ends at
// the first one, and only a pointy-bracket destination may contain one — so a
// parser that ignores the grammar gets `[link](/my uri)` and
// `[link](</my uri>)` exactly backwards (marktext#2377).

const TITLE_CLOSERS: Record<string, string> = {
    '"': '"',
    '\'': '\'',
    '(': ')',
};

export interface ILinkTail {
    src: string;
    title: string;
    /** UTF-16 offset of the closing `)`, excluded from the destination/title source. */
    length: number;
}

function isControlOrSpace(char: string) {
    const code = char.codePointAt(0)!;

    return code <= 0x20 || code === 0x7F;
}

function skipSpaces(text: string, index: number) {
    let i = index;
    let lineEndings = 0;
    while (i < text.length && /[ \t\n\r]/.test(text[i])) {
        if (text[i] === '\n' || text[i] === '\r') {
            lineEndings++;
            if (lineEndings > 1)
                return -1;
            if (text[i] === '\r' && text[i + 1] === '\n')
                i++;
        }
        i++;
    }
    return i;
}

/**
 * Index of the `>` closing the pointy-bracket destination that opens at
 * `start`, or -1 when there is none — an unescaped `<` or a line ending
 * inside the brackets ends the search, as does running out of text.
 */
function findAngleDestinationEnd(text: string, start: number) {
    for (let i = start + 1; i < text.length; i++) {
        if (isPunctuationEscape(text, i)) {
            i++;
            continue;
        }

        const char = text[i];
        if (char === '<' || char === '\n' || char === '\r')
            return -1;
        if (char === '>')
            return i;
    }

    return -1;
}

/** Index just past a bare destination, or -1 when its parentheses don't pair up. */
function findBareDestinationEnd(text: string, start: number) {
    let depth = 0;
    let i = start;

    while (i < text.length) {
        if (isPunctuationEscape(text, i)) {
            i += 2;
            continue;
        }

        const char = text[i];
        // A space ends the destination; so does the `)` that closes the link.
        if (isControlOrSpace(char))
            break;
        if (char === ')' && depth === 0)
            break;

        if (char === '(')
            depth++;
        else if (char === ')')
            depth--;

        i++;
    }

    return depth === 0 ? i : -1;
}

/** Index just past a title opening at `start`, or -1 when it never closes. */
function findTitleEnd(text: string, start: number) {
    const closer = TITLE_CLOSERS[text[start]];
    if (!closer)
        return -1;

    for (let i = start + 1; i < text.length; i++) {
        if (isPunctuationEscape(text, i)) {
            i++;
            continue;
        }

        const char = text[i];
        if ((char === '\n' || char === '\r') && /^(?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n?|\n)/.test(text.slice(i)))
            return -1;
        // A parenthesised title may not contain an unescaped `(`.
        if (char === '(' && closer === ')')
            return -1;
        if (char === closer)
            return i + 1;
    }

    return -1;
}

/**
 * Read the destination and title out of the text a link's or image's `](`
 * opens, with escapes and entity references resolved, or null when it is not a
 * well-formed pair — in which case the whole `[...](...)` run is literal text.
 *
 * The text may run past the link; `length` identifies its closing parenthesis.
 */
export function parseSrcAndTitle(text = ''): ILinkTail | null {
    const start = skipSpaces(text, 0);
    if (start < 0)
        return null;
    let index: number;
    let src: string;

    if (text[start] === '<') {
        const end = findAngleDestinationEnd(text, start);
        if (end < 0)
            return null;

        src = text.slice(start + 1, end);
        index = end + 1;
    }
    else {
        const end = findBareDestinationEnd(text, start);
        if (end < 0)
            return null;

        src = text.slice(start, end);
        index = end;
    }

    let title = '';
    const titleStart = skipSpaces(text, index);
    if (titleStart < 0)
        return null;
    if (titleStart < text.length && text[titleStart] !== ')') {
        // The spec asks for spaces between the two, so `[link](/url"title")` is
        // one destination rather than a destination and a title.
        if (titleStart === index)
            return null;

        const titleEnd = findTitleEnd(text, titleStart);
        if (titleEnd < 0)
            return null;

        title = text.slice(titleStart + 1, titleEnd - 1);
        index = skipSpaces(text, titleEnd);
    }
    else {
        index = titleStart;
    }

    // Anything left over is neither destination nor title, so the `(` never
    // opened a link: `[link](/url "title" "extra")`.
    if (index < 0 || (index !== text.length && text[index] !== ')'))
        return null;

    return {
        src: decodeMarkdownString(src),
        title: decodeMarkdownString(title),
        length: index,
    };
}
