import type { InlineRules } from './rules';
import type { ITokenizerFacOptions } from './types';
import { isLengthEven } from '../utils';
import {
    CJK_REG,
    codePointBefore,
    codePointCharAt,
    correctUrl,
    PUNCTUATION_REG,
    UNICODE_WHITESPACE_REG,
} from './utils';

export interface IEmphasisSpan {
    // Index of the first character of the opening delimiter.
    start: number;
    // Index one past the last character of the closing delimiter.
    end: number;
    // 1 for `em`, 2 for `strong`.
    markerLen: number;
}

interface IDelimiterRun {
    index: number;
    char: string;
    // Length of the whole run, which rule-of-three below is defined on.
    length: number;
    // Characters of the run not yet consumed by a pairing. The opener spends
    // them right-to-left, the closer left-to-right, so the two spans of a
    // nested pair stay properly nested.
    remaining: number;
    canOpen: boolean;
    canClose: boolean;
}

function isWhitespace(char: string) {
    return char === '' || UNICODE_WHITESPACE_REG.test(char);
}

// CommonMark §6.2 counts only whitespace and Unicode punctuation as flanking
// boundaries. `CJK_REG` widens that additively — see the long note on the
// regexp in ./utils.ts (marktext#4307).
function isBoundary(char: string) {
    return isWhitespace(char) || PUNCTUATION_REG.test(char) || CJK_REG.test(char);
}

function charBefore(src: string, index: number) {
    return index <= 0 ? '\n' : codePointBefore(src, index);
}

function charAfter(src: string, index: number) {
    return codePointCharAt(src, index) ?? '\n';
}

function firstMatchLength(rest: string, ...patterns: (RegExp | false)[]): number {
    for (const pattern of patterns) {
        const to = pattern && pattern.exec(rest);
        if (to)
            return to[0].length;
    }

    return 0;
}

// A link or image is only as long as its balanced destination, and only when
// neither bracket is escaped — same gate `tryImage` / `tryLink` apply.
function bracketedLength(rest: string, pattern: RegExp): number {
    const to = pattern.exec(rest);
    correctUrl(to);

    return to && isLengthEven(to[3]) && isLengthEven(to[5]) ? to[0].length : 0;
}

// Cheap pre-filter so the scan only builds a substring and runs patterns at
// the few characters that can start one of the constructs below.
const TIGHTER_OPENERS = '`$\\<![';

// Length of a construct that binds more tightly than emphasis (CommonMark
// §6.4 rule 17), or 0 when none starts here. Delimiters inside one of these
// are invisible to emphasis: `*a `*`*` is one em around a code span, not two
// stray asterisks around `a `.
function tighterConstructLength(
    src: string,
    index: number,
    rules: InlineRules,
    options: ITokenizerFacOptions,
): number {
    const char = src[index];
    if (!TIGHTER_OPENERS.includes(char))
        return 0;

    const rest = src.substring(index);

    switch (char) {
        case '`':
            return firstMatchLength(rest, rules.inline_code);

        case '$':
            return firstMatchLength(
                rest,
                options.texMathGfm && rules.inline_math_gfm,
                options.texMathDollars && rules.inline_math,
            );

        case '\\':
            return firstMatchLength(
                rest,
                options.texMathDoubleBackslash && rules.inline_math_double_backslash,
                options.texMathDoubleBackslash && rules.display_math_double_backslash,
                options.texMathSingleBackslash && rules.inline_math_single_backslash,
                options.texMathSingleBackslash && rules.display_math_single_backslash,
            );

        case '<':
            return firstMatchLength(rest, rules.auto_link, rules.html_tag);

        case '!':
            return bracketedLength(rest, rules.image);

        case '[':
            return bracketedLength(rest, rules.link);

        default:
            return 0;
    }
}

function collectRuns(
    src: string,
    rules: InlineRules,
    options: ITokenizerFacOptions,
): IDelimiterRun[] {
    const runs: IDelimiterRun[] = [];
    let i = 0;

    while (i < src.length) {
        const char = src[i];

        if (char === '\\') {
            const escaped = rules.backlash.exec(src.substring(i));
            if (escaped) {
                i += escaped[0].length;
                continue;
            }
        }

        if (char === '*' || char === '_') {
            let length = 1;
            while (src[i + length] === char)
                length++;

            const before = charBefore(src, i);
            const after = charAfter(src, i + length);
            const leftFlanking
                = !isWhitespace(after)
                    && (!PUNCTUATION_REG.test(after) || isBoundary(before));
            const rightFlanking
                = !isWhitespace(before)
                    && (!PUNCTUATION_REG.test(before) || isBoundary(after));

            runs.push({
                index: i,
                char,
                length,
                remaining: length,
                canOpen: leftFlanking && (char === '*' || isBoundary(before)),
                canClose: rightFlanking && (char === '*' || isBoundary(after)),
            });
            i += length;
            continue;
        }

        const skip = tighterConstructLength(src, i, rules, options);
        i += skip > 0 ? skip : 1;
    }

    return runs;
}

// CommonMark §6.2: when either delimiter can both open and close, the two run
// lengths may not sum to a multiple of three unless both are themselves
// multiples of three.
function violatesRuleOfThree(opener: IDelimiterRun, closer: IDelimiterRun) {
    if (!opener.canClose && !closer.canOpen)
        return false;

    if ((opener.length + closer.length) % 3 !== 0)
        return false;

    return opener.length % 3 !== 0 || closer.length % 3 !== 0;
}

/**
 * Pair up the `*` / `_` delimiter runs of one inline string the way
 * CommonMark §6.2 does, keyed by the index the opening delimiter starts at.
 *
 * A closer always binds to the *nearest* still-open opener, which is what a
 * left-to-right regexp cannot express: in `*a *b* c*` the middle `*` is
 * preceded by a space, so it can only open, and it takes the third `*` as its
 * partner — leaving the outer pair to span the whole line (marktext#2086).
 *
 * Nested pairs get their own entry, so the caller can tokenize a span's
 * content by rescanning it.
 */
export function scanEmphasisSpans(
    src: string,
    rules: InlineRules,
    options: ITokenizerFacOptions,
): Map<number, IEmphasisSpan> {
    const runs = collectRuns(src, rules, options);
    const spans = new Map<number, IEmphasisSpan>();
    // Indices into `runs` of the openers still available, innermost last.
    const openers: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const closer = runs[i];

        while (closer.canClose && closer.remaining > 0) {
            let top = openers.length - 1;
            while (top >= 0) {
                const candidate = runs[openers[top]];
                if (
                    candidate.char === closer.char
                    && candidate.remaining > 0
                    && !violatesRuleOfThree(candidate, closer)
                ) {
                    break;
                }
                top--;
            }

            if (top < 0)
                break;

            const opener = runs[openers[top]];
            // Openers skipped over can never find a partner now that this
            // closer has reached past them.
            openers.length = top + 1;

            const markerLen = opener.remaining >= 2 && closer.remaining >= 2 ? 2 : 1;
            const start = opener.index + opener.remaining - markerLen;
            const end = closer.index + closer.length - closer.remaining + markerLen;
            spans.set(start, { start, end, markerLen });

            opener.remaining -= markerLen;
            closer.remaining -= markerLen;
            if (opener.remaining === 0)
                openers.pop();
        }

        if (closer.canOpen && closer.remaining > 0)
            openers.push(i);
    }

    return spans;
}
