// Ordered-list markers as pandoc's `fancy_lists` extension reads and writes
// them: https://pandoc.org/MANUAL.html#extension-fancy_lists

export type ListStyle = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

/** `.` is `1.`, `)` is `1)` and `()` is `(1)`. */
export type ListDelimiter = '.' | ')' | '()';

export interface IListMarker {
    value: number;
    style: ListStyle;
    delimiter: ListDelimiter;
}

export interface IListLevel {
    style: ListStyle;
    delimiter: ListDelimiter;
}

const LIST_DELIMITERS: readonly ListDelimiter[] = ['.', ')', '()'];

// Pandoc's numeral grammar, which also takes non-canonical forms such as
// `IIII`. Repeated groups count once per letter.
const ROMAN = /^(M*)(CM)?(D)?(CD)?(C*)(XC)?(L)?(XL)?(X*)(IX)?(V)?(IV)?(I*)$/;
const ROMAN_WEIGHTS = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
const ROMAN_REPEATED = new Set([0, 4, 8, 12]);
const ROMAN_SYMBOLS = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];

function readRoman(upper: string): number | null {
    const groups = ROMAN.exec(upper);
    if (!groups)
        return null;
    const value = groups.slice(1).reduce((sum, group, index) => {
        if (!group)
            return sum;
        return sum + ROMAN_WEIGHTS[index] * (ROMAN_REPEATED.has(index) ? group.length : 1);
    }, 0);

    return value > 0 ? value : null;
}

function writeRoman(value: number): string {
    let rest = value;
    let result = '';
    for (const [index, weight] of ROMAN_WEIGHTS.entries()) {
        while (rest >= weight) {
            result += ROMAN_SYMBOLS[index];
            rest -= weight;
        }
    }

    return result;
}

// Pandoc's own writer wraps past `z`; any single letter continues an alpha
// list, so the wrapped text still reads back as the same list.
function writeAlpha(value: number): string {
    return String.fromCharCode(97 + ((value - 1) % 26));
}

const STYLES: Record<ListStyle, { read: (body: string) => number | null; write: (value: number) => string }> = {
    'decimal': {
        read: body => (/^\d{1,9}$/.test(body) ? Number(body) : null),
        write: value => String(value),
    },
    'lower-alpha': {
        read: body => (/^[a-z]$/.test(body) ? body.charCodeAt(0) - 96 : null),
        write: writeAlpha,
    },
    'upper-alpha': {
        read: body => (/^[A-Z]$/.test(body) ? body.charCodeAt(0) - 64 : null),
        write: value => writeAlpha(value).toUpperCase(),
    },
    'lower-roman': {
        read: body => (/^[a-z]+$/.test(body) ? readRoman(body.toUpperCase()) : null),
        write: value => writeRoman(value).toLowerCase(),
    },
    'upper-roman': {
        read: body => (/^[A-Z]+$/.test(body) ? readRoman(body) : null),
        write: writeRoman,
    },
};

// A list's first marker picks its style: `i`/`I` is roman one, any other
// single letter is alphabetic, and longer letter runs are roman.
function firstMarkerStyle(body: string): ListStyle {
    if (/^\d/.test(body))
        return 'decimal';
    const upper = body === body.toUpperCase();
    if (body.length > 1 || body === 'i' || body === 'I')
        return upper ? 'upper-roman' : 'lower-roman';

    return upper ? 'upper-alpha' : 'lower-alpha';
}

/**
 * Read a marker such as `IV.`, `(a)` or `3)`. Without `continueStyle` the
 * text is read as a list's first marker; with it, as a later item of a list
 * in that style (so `v.` continues an `i.` list as five).
 */
export function parseListMarker(text: string, continueStyle?: ListStyle): IListMarker | null {
    const match = /^(?:\(([^()]+)\)|([^().]+)([.)]))$/.exec(text);
    if (!match)
        return null;
    const body = match[1] ?? match[2];
    const delimiter: ListDelimiter = match[1] ? '()' : match[3] === '.' ? '.' : ')';
    const style = continueStyle ?? firstMarkerStyle(body);
    const value = STYLES[style].read(body);

    return value === null ? null : { value, style, delimiter };
}

export function formatListMarker({ value, style, delimiter }: IListMarker): string {
    const body = STYLES[style].write(value);

    return delimiter === '()' ? `(${body})` : `${body}${delimiter}`;
}

// Pandoc wants two spaces after a marker that could be an initial, so that
// `B. Russell won` stays a paragraph.
const INITIAL_LIKE_ROMAN = new Set([1, 5, 10, 50, 100, 500, 1000]);

/** Fewest spaces pandoc accepts between this marker and the item text. */
export function minSpacesAfterMarker({ value, style, delimiter }: IListMarker): 1 | 2 {
    const initialLike = style === 'upper-alpha' || (style === 'upper-roman' && INITIAL_LIKE_ROMAN.has(value));

    return delimiter === '.' && initialLike ? 2 : 1;
}

export function toListDelimiter(value: string): ListDelimiter {
    return LIST_DELIMITERS.find(delimiter => delimiter === value) ?? '.';
}

/** Marker style for each nesting depth of an academic outline. */
export const OUTLINE_LADDER: readonly IListLevel[] = [
    { style: 'upper-roman', delimiter: '.' },
    { style: 'upper-alpha', delimiter: '.' },
    { style: 'decimal', delimiter: '.' },
    { style: 'lower-alpha', delimiter: '.' },
    { style: 'lower-roman', delimiter: '.' },
    { style: 'decimal', delimiter: '()' },
    { style: 'lower-alpha', delimiter: '()' },
];

/** Ladder level for a zero-based depth; deeper levels reuse the last one. */
export function outlineLevel(depth: number): IListLevel {
    return OUTLINE_LADDER[Math.min(Math.max(depth, 0), OUTLINE_LADDER.length - 1)];
}
