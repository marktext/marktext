import type { InlineRules } from './rules';
import type { ITokenizerFacOptions, Labels } from './types';
import { isLengthEven } from '../utils';
import { linkValidateRules } from './rules';
import {
    CJK_REG,
    codePointBefore,
    codePointCharAt,
    correctUrl,
    lowerPriority,
    PUNCTUATION_REG,
    trimAutoLinkExtent,
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
    char: string;
    // Length of the whole run, which rule-of-three is defined on.
    length: number;
    // The run's unspent characters, `[left, right)`. A closer spends them from
    // the left and an opener from the right, so a run that does both — the
    // `***` in `*foo***bar*` — keeps its two pairings properly nested. A single
    // "remaining" counter cannot express that: it would hand out the same
    // character twice and emit overlapping spans.
    left: number;
    right: number;
    canOpen: boolean;
    canClose: boolean;
}

function isWhitespace(char: string) {
    return UNICODE_WHITESPACE_REG.test(char);
}

// CommonMark §6.2 counts only whitespace and Unicode punctuation as flanking
// boundaries. `CJK_REG` widens that additively — see the long note on the
// regexp in ./utils.ts (marktext#4307).
function isBoundary(char: string) {
    return isWhitespace(char) || PUNCTUATION_REG.test(char) || CJK_REG.test(char);
}

// The beginning and the end of the line count as whitespace (CommonMark §6.2).
function charBefore(src: string, index: number) {
    return index <= 0 ? '\n' : codePointBefore(src, index);
}

function charAfter(src: string, index: number) {
    return codePointCharAt(src, index) ?? '\n';
}

// The inline rules are `^`-anchored, so matching one at position `i` would mean
// copying the rest of the paragraph. A sticky clone matches at an index
// instead, with identical semantics and no allocation.
const stickyPatterns = new WeakMap<RegExp, RegExp>();

function matchAt(pattern: RegExp, src: string, index: number) {
    let sticky = stickyPatterns.get(pattern);
    if (!sticky) {
        sticky = new RegExp(pattern.source.replace(/^\^/, ''), `${pattern.flags}y`);
        stickyPatterns.set(pattern, sticky);
    }
    sticky.lastIndex = index;

    return sticky.exec(src);
}

function lengthAt(pattern: RegExp, src: string, index: number) {
    return matchAt(pattern, src, index)?.[0].length ?? 0;
}

// An inline link / image counts only when its destination's brackets balance
// and neither bracket is escaped, and — for a link — when nothing that binds
// even tighter overruns it. The same gates `tryImage` / `tryLink` apply, so the
// scan and the tokenizer agree on where one starts and ends.
function inlineBracketLength(
    pattern: RegExp,
    src: string,
    index: number,
    validate: boolean,
) {
    const to = matchAt(pattern, src, index);
    correctUrl(to);
    if (!to || !isLengthEven(to[3]) || !isLengthEven(to[5]))
        return 0;

    if (validate && !lowerPriority(src.substring(index), to[0].length, linkValidateRules))
        return 0;

    return to[0].length;
}

// A reference link / image counts only when its label resolves; otherwise the
// tokenizer leaves the brackets as text and the delimiters between them are real.
function referenceBracketLength(
    pattern: RegExp,
    src: string,
    index: number,
    labels: Labels,
) {
    const to = matchAt(pattern, src, index);

    return to
        && labels.has((to[3] || to[1]).toLowerCase())
        && isLengthEven(to[2])
        && isLengthEven(to[4])
        ? to[0].length
        : 0;
}

// A GFM extended autolink is recognised only at a boundary, and its greedy
// `\S+` tail has to be trimmed back the way `tryAutoLinkExtension` trims it —
// otherwise `*see http://x.com*` would swallow its own closing delimiter.
function extendedAutoLinkLength(src: string, index: number, rules: InlineRules) {
    if (index > 0 && !/[* _~(]/.test(src[index - 1]))
        return 0;

    const to = matchAt(rules.auto_link_extension, src, index);
    if (!to)
        return 0;

    // Group 3 is the email form, whose extent the domain regexp already fixes.
    return to[3] ? to[0].length : trimAutoLinkExtent(to[0]).length;
}

function mathLength(
    src: string,
    index: number,
    rules: InlineRules,
    options: ITokenizerFacOptions,
) {
    if (options.texMathDoubleBackslash) {
        const length = lengthAt(rules.inline_math_double_backslash, src, index)
            || lengthAt(rules.display_math_double_backslash, src, index);
        if (length)
            return length;
    }

    if (options.texMathSingleBackslash) {
        return lengthAt(rules.inline_math_single_backslash, src, index)
            || lengthAt(rules.display_math_single_backslash, src, index);
    }

    return 0;
}

// How many characters from `index` can hold no emphasis delimiter, because they
// belong to a backslash escape or to a construct that binds more tightly than
// emphasis (CommonMark §6.4 rule 17) — 0 when none starts here. This is what
// makes `*a `*`*` one em around a code span instead of two stray asterisks.
// `~~` is deliberately absent: GFM strikethrough is a delimiter run in its own
// right, not a span emphasis has to step over. Backslash-delimited math comes
// before the plain escape, as in `INLINE_HANDLERS`: `backlash` matches `\(` and
// would otherwise eat the formula's opener.
function inertRunLength(
    src: string,
    index: number,
    rules: InlineRules,
    labels: Labels,
    options: ITokenizerFacOptions,
): number {
    switch (src[index]) {
        case '\\':
            return mathLength(src, index, rules, options)
                || lengthAt(rules.backlash, src, index);

        case '`':
            return lengthAt(rules.inline_code, src, index);

        case '$':
            return (options.texMathGfm ? lengthAt(rules.inline_math_gfm, src, index) : 0)
                || (options.texMathDollars ? lengthAt(rules.inline_math, src, index) : 0);

        case '<':
            return lengthAt(rules.auto_link, src, index)
                || lengthAt(rules.html_tag, src, index);

        case '!':
            return inlineBracketLength(rules.image, src, index, false)
                || referenceBracketLength(rules.reference_image, src, index, labels);

        case '[':
            return inlineBracketLength(rules.link, src, index, true)
                || referenceBracketLength(rules.reference_link, src, index, labels);

        default:
            return /[a-z0-9]/i.test(src[index])
                ? extendedAutoLinkLength(src, index, rules)
                : 0;
    }
}

function collectRuns(
    src: string,
    rules: InlineRules,
    labels: Labels,
    options: ITokenizerFacOptions,
): IDelimiterRun[] {
    const runs: IDelimiterRun[] = [];
    let i = 0;

    while (i < src.length) {
        const char = src[i];

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
                char,
                length,
                left: i,
                right: i + length,
                // The intraword rule: `_` additionally needs a boundary on the
                // side facing away from the text it would emphasise.
                canOpen: leftFlanking && (char === '*' || isBoundary(before)),
                canClose: rightFlanking && (char === '*' || isBoundary(after)),
            });
            i += length;
            continue;
        }

        const inert = inertRunLength(src, i, rules, labels, options);
        i += inert > 0 ? inert : 1;
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
 * CommonMark §6.2 does, keyed by the position the opening delimiter starts at.
 * `base` is where `src` sits in the enclosing document, so the keys line up
 * with the tokenizer's own offsets.
 *
 * A closer always binds to the *nearest* still-open opener, which is what a
 * left-to-right regexp cannot express: in `*a *b* c*` the middle `*` is
 * preceded by a space, so it can only open, and it takes the third `*` as its
 * partner — leaving the outer pair to span the whole line (marktext#2086).
 *
 * Nested pairs get their own entry, so one scan describes the whole tree and
 * the tokenizer hands the same map down to the children it recurses into.
 * Rescanning a span's content on its own would decide its edge runs against
 * the string boundary rather than against the markers now around them, and
 * could pair runs this scan deliberately left alone.
 */
export function scanEmphasisSpans(
    src: string,
    base: number,
    rules: InlineRules,
    labels: Labels,
    options: ITokenizerFacOptions,
): Map<number, IEmphasisSpan> {
    const runs = collectRuns(src, rules, labels, options);
    const spans = new Map<number, IEmphasisSpan>();
    // Indices into `runs` of the openers still available, innermost last.
    const openers: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const closer = runs[i];

        while (closer.canClose && closer.right > closer.left) {
            let top = openers.length - 1;
            while (top >= 0) {
                const candidate = runs[openers[top]];
                if (
                    candidate.char === closer.char
                    && candidate.right > candidate.left
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

            const markerLen
                = opener.right - opener.left >= 2 && closer.right - closer.left >= 2
                    ? 2
                    : 1;
            opener.right -= markerLen;
            closer.left += markerLen;
            spans.set(base + opener.right, {
                start: base + opener.right,
                end: base + closer.left,
                markerLen,
            });

            if (opener.right === opener.left)
                openers.pop();
        }

        if (closer.canOpen && closer.right > closer.left)
            openers.push(i);
    }

    return spans;
}
