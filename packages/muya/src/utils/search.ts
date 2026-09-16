import type { IMatch, ISearchOption } from '../search/types';
import { graphemeClusters } from '.';

export interface IStringMatch {
    match: string;
    subMatches: (string | undefined)[];
    index: number;
}

function isHighSurrogate(code: number) {
    return code >= 0xD800 && code <= 0xDBFF;
}

function isLowSurrogate(code: number) {
    return code >= 0xDC00 && code <= 0xDFFF;
}

// Whether `index` falls between the two halves of a surrogate pair.
function splitsSurrogatePair(text: string, index: number) {
    return isHighSurrogate(text.charCodeAt(index - 1)) && isLowSurrogate(text.charCodeAt(index));
}

function execAll(regexp: RegExp, text: string): IStringMatch[] {
    const matches: IStringMatch[] = [];
    let result: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((result = regexp.exec(text)) !== null) {
        const [match, ...subMatches] = result;
        const { index } = result;
        // A zero-width match (`\b`, a lookahead) leaves `lastIndex` in place, so
        // `exec` would return it forever and freeze the editor. A Unicode-mode
        // RegExp resumes from the start of a pair, so step over the whole pair.
        if (match === '')
            regexp.lastIndex = index + (regexp.unicode && splitsSurrogatePair(text, index + 1) ? 2 : 1);

        matches.push({ match, subMatches, index });
    }

    return matches;
}

// Below U+0300, where combining marks start, every character other than the CR
// of a CR LF pair is a grapheme cluster of its own.
function mayHaveMultiUnitClusters(text: string) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0x300 || code === 0x0D)
            return true;
    }

    return false;
}

// A grapheme cluster — an emoji ZWJ sequence, a letter with combining marks — is
// one character on screen and is replaced as a unit. Replacing part of one would
// also break it, or leave a lone surrogate the text OT type cannot encode
// (#4926). So a literal query covering only part of a cluster did not find that
// character and is dropped, while a regexp match reaching into one (`.`,
// `[^a-z]`) takes the whole cluster. A zero-width match inside a cluster is
// dropped: inserting there would split it.
function alignToGraphemeClusters(text: string, matches: IStringMatch[], expand: boolean): IStringMatch[] {
    if (!matches.length || !mayHaveMultiUnitClusters(text))
        return matches;

    const isBoundary = Array.from<boolean>({ length: text.length + 1 }).fill(false);
    for (const { start } of graphemeClusters(text))
        isBoundary[start] = true;
    isBoundary[text.length] = true;

    const aligned: IStringMatch[] = [];
    for (const match of matches) {
        let start = match.index;
        let end = start + match.match.length;
        if (!isBoundary[start] || !isBoundary[end]) {
            if (!expand || start === end)
                continue;

            while (!isBoundary[start])
                start--;
            while (!isBoundary[end])
                end++;
        }

        const previous = aligned[aligned.length - 1];
        const previousEnd = previous ? previous.index + previous.match.length : 0;
        // Expanded matches can overlap; merge them so each character is
        // replaced once.
        if (previous && start < previousEnd) {
            if (end > previousEnd)
                previous.match = text.slice(previous.index, end);

            continue;
        }

        aligned.push({ ...match, match: text.slice(start, end), index: start });
    }

    return aligned;
}

// User patterns get the Unicode flag so `.` and character classes match an
// emoji whole. Patterns that are only valid without it (e.g. `\-`) fall back to
// the plain flags.
function createSearchRegExp(source: string, flags: string, isRegexp: boolean): RegExp | null {
    const candidates = isRegexp ? [`${flags}u`, flags] : [flags];
    for (const candidate of candidates) {
        try {
            return new RegExp(source, candidate);
        }
        catch {
            // Not a valid pattern with these flags; try the next set.
        }
    }

    return null;
}

export function matchString(text: string, value: string, options: ISearchOption): IStringMatch[] {
    const { isCaseSensitive, isWholeWord, isRegexp } = options;

    const SPECIAL_CHAR_REG = /[[\]\\^$.|?*+()/]/g;

    let regStr = value;
    let flag = 'g';

    if (!isCaseSensitive)
        flag += 'i';

    if (!isRegexp) {
        regStr = value.replace(SPECIAL_CHAR_REG, (p) => {
            return p === '\\' ? '\\\\' : `\\${p}`;
        });
    }

    if (isWholeWord)
        regStr = `\\b${regStr}\\b`;

    const regexp = createSearchRegExp(regStr, flag, !!isRegexp);

    return regexp ? alignToGraphemeClusters(text, execAll(regexp, text), !!isRegexp) : [];
}

// A replacer function, not a replacement string: the latter would read `$$` and
// `$&` inside the captured text as patterns instead of inserting them.
export function buildRegexValue(match: IMatch, value: string) {
    return value.replace(/(?<!\\)\$(\d)/g, (placeholder, digit: string) => {
        const index = Number.parseInt(digit);
        if (index === 0)
            return match.match;

        return index <= match.subMatches.length ? match.subMatches[index - 1] ?? '' : placeholder;
    });
}
