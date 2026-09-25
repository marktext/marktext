import type { InlineRules } from './rules';
import type { ITokenizerFacOptions, Labels } from './types';
import { BACKSLASH_MATH_RULES, linkValidateRules } from './rules';
import {
    CJK_REG,
    codePointBefore,
    codePointCharAt,
    matchAt,
    matchBracketed,
    matchExtendedAutoLink,
    matchReference,
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

// What the whole scan needs to know about its input beyond the string itself.
interface IScanContext {
    rules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
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

function lengthOf(to: RegExpExecArray | null) {
    return to?.[0].length ?? 0;
}

function backslashMathLength(src: string, index: number, { rules, options }: IScanContext) {
    for (const [rule, option] of BACKSLASH_MATH_RULES) {
        const length = options[option] ? lengthOf(matchAt(rules[rule], src, index)) : 0;
        if (length)
            return length;
    }

    return 0;
}

function dollarMathLength(src: string, index: number, { rules, options }: IScanContext) {
    const gfm = options.texMathGfm
        ? lengthOf(matchAt(rules.inline_math_gfm, src, index))
        : 0;

    return gfm || (options.texMathDollars
        ? lengthOf(matchAt(rules.inline_math, src, index))
        : 0);
}

function autoLinkLength(src: string, index: number, context: IScanContext) {
    if (!/[a-z0-9]/i.test(src[index]))
        return 0;

    return lengthOf(
        matchExtendedAutoLink(context.rules.auto_link_extension, src, index, context.top),
    );
}

// How many characters from `index` can hold no emphasis delimiter, because they
// belong to a backslash escape or to a construct that binds more tightly than
// emphasis (CommonMark §6.4 rule 17) — 0 when none starts here. This is what
// makes `*a `*`*` one em around a code span instead of two stray asterisks.
// `~~` is deliberately absent: GFM strikethrough is a delimiter run in its own
// right, not a span emphasis has to step over. Backslash-delimited math comes
// before the plain escape, as in `INLINE_HANDLERS`: `backlash` matches `\(` and
// would otherwise eat the formula's opener.
function inertRunLength(src: string, index: number, context: IScanContext): number {
    const { rules, labels } = context;

    switch (src[index]) {
        case '\\':
            return backslashMathLength(src, index, context)
                || lengthOf(matchAt(rules.backlash, src, index));

        case '`':
            return lengthOf(matchAt(rules.inline_code, src, index));

        case '$':
            return dollarMathLength(src, index, context);

        case '<':
            return lengthOf(matchAt(rules.auto_link, src, index))
                || lengthOf(matchAt(rules.html_tag, src, index));

        case '!':
            return lengthOf(matchBracketed(rules.image, src, index, null))
                || lengthOf(matchReference(rules.reference_image, src, index, labels, null));

        case '[':
            return lengthOf(matchBracketed(rules.link, src, index, linkValidateRules))
                || lengthOf(matchReference(rules.reference_link, src, index, labels, linkValidateRules));

        default:
            return autoLinkLength(src, index, context);
    }
}

function collectRuns(src: string, context: IScanContext): IDelimiterRun[] {
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

        const inert = inertRunLength(src, i, context);
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
    top: boolean,
): Map<number, IEmphasisSpan> {
    const runs = collectRuns(src, { rules, labels, options, top });
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
