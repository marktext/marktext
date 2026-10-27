import type { IDelimiterRun, IDelimiterSpan } from '../utils/delimiters';
import type { InlineRules } from './rules';
import type { ITokenizerFacOptions, Labels } from './types';
import { codePointBefore, codePointCharAt, pairDelimiters } from '../utils/delimiters';
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

export type { IDelimiterSpan } from '../utils/delimiters';

interface IScanContext {
    rules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    allowAutolinks: boolean;
    scanAutolinks: boolean;
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

function lengthOf(match: RegExpExecArray | null) {
    return match?.[0].length ?? 0;
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
    if (!context.scanAutolinks || !isAsciiAlphanumeric(src.charCodeAt(index)))
        return 0;

    return lengthOf(
        matchExtendedAutoLink(context.rules.auto_link_extension, src, index, context.allowAutolinks),
    );
}

function protectedLength(src: string, index: number, context: IScanContext): number {
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

        if (char === '*' || char === '_' || char === '~') {
            let length = 1;
            while (src[i + length] === char)
                length++;

            if (char === '~' && (length > 2 || (length === 1 && context.options.superSubScript))) {
                i += length;
                continue;
            }

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
                canOpen: leftFlanking && (char !== '_' || isBoundary(before)),
                canClose: rightFlanking && (char !== '_' || isBoundary(after)),
            });
            i += length;
            continue;
        }

        const skipLength = protectedLength(src, i, context);
        i += skipLength > 0 ? skipLength : 1;
    }

    return runs;
}

export function scanDelimiterSpans(
    src: string,
    offset: number,
    rules: InlineRules,
    labels: Labels,
    options: ITokenizerFacOptions,
    allowAutolinks: boolean,
): Map<number, IDelimiterSpan> {
    const runs = collectRuns(src, {
        rules,
        labels,
        options,
        allowAutolinks,
        scanAutolinks:
            allowAutolinks
            && (src.includes('www.') || src.includes('http') || src.includes('@')),
    });
    return pairDelimiters(runs, offset);
}
