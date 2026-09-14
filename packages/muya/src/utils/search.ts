import type { IMatch, ISearchOption } from '../search/types';

export interface IStringMatch {
    match: string;
    subMatches: string[];
    index: number;
}

function execAll(regexp: RegExp, text: string): IStringMatch[] {
    const matches: IStringMatch[] = [];
    let result: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((result = regexp.exec(text)) !== null) {
        const [match, ...subMatches] = result;
        // A zero-width match (`\b`, a lookahead) leaves `lastIndex` in place, so
        // `exec` would return it forever and freeze the editor.
        if (match === '')
            regexp.lastIndex++;

        matches.push({ match, subMatches, index: result.index });
    }

    return matches;
}

export function matchString(text: string, value: string, options: ISearchOption): IStringMatch[] {
    const { isCaseSensitive, isWholeWord, isRegexp } = options;

    const SPECIAL_CHAR_REG = /[[\]\\^$.|?*+()/]/g;

    let SEARCH_REG = null;
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

    try {
    // Add try catch expression because not all string can generate a valid RegExp. for example `\`.
        SEARCH_REG = new RegExp(regStr, flag);

        return execAll(SEARCH_REG, text);
    }
    catch {
        return [];
    }
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
