// CommonMark 0.31 §6.3: what sits between a link's `](` and its `)` is a link
// destination followed by an optional link title, not free-form text. The two
// forms of destination disagree about the space — a bare destination ends at
// the first one, and only a pointy-bracket destination may contain one — so a
// parser that ignores the grammar gets `[link](/my uri)` and
// `[link](</my uri>)` exactly backwards (marktext#2377).

// The characters a backslash may escape: CommonMark only recognises an escape
// before ASCII punctuation, so `my\ file` keeps its backslash *and* still ends
// at the space. The backslash itself is in the set, which is what makes `\\`
// one escaped backslash rather than an escape of whatever follows it.
const ASCII_PUNCTUATION_REG = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const TITLE_CLOSERS: Record<string, string> = {
    '"': '"',
    '\'': '\'',
    '(': ')',
};

export interface ILinkTail {
    src: string;
    title: string;
    /**
     * How much of the text the destination and title occupy. The link's `)`
     * has to be the very next character, which is what lets a caller cut a
     * greedily matched `[a](b) c (d)` back down to `[a](b)`.
     */
    length: number;
}

function isEscape(text: string, index: number) {
    return text[index] === '\\' && ASCII_PUNCTUATION_REG.test(text[index + 1] ?? '');
}

function isControlOrSpace(char: string) {
    const code = char.codePointAt(0)!;

    return code <= 0x20 || code === 0x7F;
}

function skipSpaces(text: string, index: number) {
    let i = index;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t'))
        i++;

    return i;
}

// Drops the backslash of every escape the scan above recognised. Sharing
// `isEscape` rather than spelling the punctuation set a second time keeps the
// two from drifting apart.
function unescapePunctuation(text: string) {
    let unescaped = '';

    for (let i = 0; i < text.length; i++) {
        if (isEscape(text, i))
            i++;
        unescaped += text[i];
    }

    return unescaped;
}

/**
 * Index of the `>` closing the pointy-bracket destination that opens at
 * `start`, or -1 when there is none — an unescaped `<` or a line ending
 * inside the brackets ends the search, as does running out of text.
 */
function findAngleDestinationEnd(text: string, start: number) {
    for (let i = start + 1; i < text.length; i++) {
        if (isEscape(text, i)) {
            i++;
            continue;
        }

        const char = text[i];
        if (char === '<' || char === '\n')
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
        if (isEscape(text, i)) {
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
        if (isEscape(text, i)) {
            i++;
            continue;
        }

        const char = text[i];
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
 * opens, with their backslash escapes resolved, or null when it is not a
 * well-formed pair — in which case the whole `[...](...)` run is literal text.
 *
 * The text may run past the link, because the pattern that produced it matches
 * to the last `)` on the line; `length` reports where this link actually ends.
 */
export function parseSrcAndTitle(text = ''): ILinkTail | null {
    const start = skipSpaces(text, 0);
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
    if (index !== text.length && text[index] !== ')')
        return null;

    return {
        src: unescapePunctuation(src),
        title: unescapePunctuation(title),
        length: index,
    };
}
