import { matchAt } from './matchAt';

const AUTO_LINK_BOUNDARY = /[* _~(]/;

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
