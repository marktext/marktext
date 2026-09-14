import type { IMatch, ISearchOption } from '../search/types';

export interface IStringMatch {
    match: string;
    subMatches: string[];
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

        // Replacing a match that starts or ends inside an emoji would leave a lone
        // surrogate, which the text OT type cannot encode (#4926).
        if (splitsSurrogatePair(text, index) || splitsSurrogatePair(text, index + match.length))
            continue;

        matches.push({ match, subMatches, index });
    }

    return matches;
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

    return regexp ? execAll(regexp, text) : [];
}

export function buildRegexValue(match: IMatch, value: string) {
    const groups = value.match(/(?<!\\)\$\d/g);

    if (Array.isArray(groups) && groups.length) {
        for (const group of groups) {
            const index = Number.parseInt(group.replace(/^\$/, ''));
            if (index === 0)
                value = value.replace(group, match.match);
            else if (index > 0 && index <= match.subMatches.length)
                value = value.replace(group, match.subMatches[index - 1]);
        }
    }

    return value;
}
