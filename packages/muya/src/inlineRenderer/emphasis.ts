import type { IDelimiterRun, IEmphasisSpan } from '../utils/emphasis';
import type { InlineRules } from './rules';
import type { ITokenizerFacOptions, Labels } from './types';
import { codePointBefore, codePointCharAt, pairEmphasisDelimiters } from '../utils/emphasis';
import { BACKSLASH_MATH_RULES, linkValidateRules } from './rules';
import {
    CJK_REG,
    matchAt,
    matchBracketed,
    matchExtendedAutoLink,
    matchReference,
    PUNCTUATION_REG,
    UNICODE_WHITESPACE_REG,
} from './utils';

export type { IEmphasisSpan } from '../utils/emphasis';

interface IScanContext {
    rules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
    mayAutoLink: boolean;
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
    return pairEmphasisDelimiters(runs, base);
}
