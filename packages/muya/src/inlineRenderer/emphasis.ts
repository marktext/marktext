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
    start: number;
    end: number;
    markerLen: number;
}

interface IDelimiterRun {
    char: string;
    length: number;
    left: number;
    right: number;
    canOpen: boolean;
    canClose: boolean;
}

interface IScanContext {
    rules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
    mayAutoLink: boolean;
}

function unspent(run: IDelimiterRun) {
    return run.right - run.left;
}

function isWhitespace(char: string) {
    return UNICODE_WHITESPACE_REG.test(char);
}

function isBoundary(char: string) {
    return isWhitespace(char) || PUNCTUATION_REG.test(char) || CJK_REG.test(char);
}

function charBefore(src: string, index: number) {
    return codePointBefore(src, index) || '\n';
}

function charAfter(src: string, index: number) {
    return codePointCharAt(src, index) ?? '\n';
}

function isAsciiAlphanumeric(code: number) {
    return (
        (code >= 48 && code <= 57)
        || (code >= 65 && code <= 90)
        || (code >= 97 && code <= 122)
    );
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
    if (!context.mayAutoLink || !isAsciiAlphanumeric(src.charCodeAt(index)))
        return 0;

    return lengthOf(
        matchExtendedAutoLink(context.rules.auto_link_extension, src, index, context.top),
    );
}

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

function violatesRuleOfThree(opener: IDelimiterRun, closer: IDelimiterRun) {
    if (!opener.canClose && !closer.canOpen)
        return false;

    if ((opener.length + closer.length) % 3 !== 0)
        return false;

    return opener.length % 3 !== 0 || closer.length % 3 !== 0;
}

function canPair(opener: IDelimiterRun, closer: IDelimiterRun) {
    return (
        opener.char === closer.char
        && unspent(opener) > 0
        && !violatesRuleOfThree(opener, closer)
    );
}

export function scanEmphasisSpans(
    src: string,
    base: number,
    rules: InlineRules,
    labels: Labels,
    options: ITokenizerFacOptions,
    top: boolean,
): Map<number, IEmphasisSpan> {
    const runs = collectRuns(src, {
        rules,
        labels,
        options,
        top,
        mayAutoLink:
            top
            && (src.includes('www.') || src.includes('http') || src.includes('@')),
    });
    const spans = new Map<number, IEmphasisSpan>();
    const openers: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const closer = runs[i];

        while (closer.canClose && unspent(closer) > 0) {
            let top = openers.length - 1;
            while (top >= 0 && !canPair(runs[openers[top]], closer))
                top--;

            if (top < 0)
                break;

            const opener = runs[openers[top]];
            openers.length = top + 1;

            const markerLen = unspent(opener) >= 2 && unspent(closer) >= 2 ? 2 : 1;
            opener.right -= markerLen;
            closer.left += markerLen;
            spans.set(base + opener.right, {
                start: base + opener.right,
                end: base + closer.left,
                markerLen,
            });

            if (unspent(opener) === 0)
                openers.pop();
        }

        if (closer.canOpen && unspent(closer) > 0)
            openers.push(i);
    }

    return spans;
}
