import type { IDelimiterRun, IDelimiterSpan } from '../../utils/delimiters';
import type { Labels } from '../model/types';
import type { ICodeSpanReader } from './codeSpan';
import type { InlineRules } from './rules';
import type { IInlineFeatures } from './types';
import { codePointBefore, codePointCharAt, delimiterFlanking, isCjkLabelCloser, pairDelimiters } from '../../utils/delimiters';
import { atomicExtensionLength } from './atomicExtension';
import { matchExtendedAutoLink } from './autoLink';
import { BracketScanner } from './brackets';
import { CodeSpanScanner } from './codeSpan';
import { matchAt } from './matchAt';

interface IScanContext {
    codeSpans?: ICodeSpanReader;
    brackets: BracketScanner;
    offset: number;
    rules: InlineRules;
    options: IInlineFeatures;
    allowAutolinks: boolean;
    scanAutolinks: boolean;
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

function autoLinkLength(src: string, index: number, context: IScanContext) {
    if (!context.scanAutolinks || !isAsciiAlphanumeric(src.charCodeAt(index)))
        return 0;

    return lengthOf(
        matchExtendedAutoLink(context.rules.auto_link_extension, src, index, context.allowAutolinks),
    );
}

function protectedLength(src: string, index: number, context: IScanContext): number {
    const { rules, offset } = context;
    switch (src[index]) {
        case '\\':
            return lengthOf(matchAt(rules.backlash, src, index));

        case '`':
            return context.codeSpans!.read(index)!.end - index;

        case '<':
            return lengthOf(matchAt(rules.auto_link, src, index))
                || lengthOf(matchAt(rules.html_tag, src, index));

        case '!':
        case '[':
            return context.brackets.read(index + offset, offset + src.length)?.raw.length ?? 0;

        default:
            return autoLinkLength(src, index, context);
    }
}

function collectRuns(src: string, context: IScanContext): IDelimiterRun[] {
    const runs: IDelimiterRun[] = [];
    let i = 0;

    while (i < src.length) {
        const char = src[i];

        const extensionLength = atomicExtensionLength(src, i, context.rules, context.options, context.offset);
        if (extensionLength) {
            i += extensionLength;
            continue;
        }
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
            const { cjkEmphasis } = context.options;
            const flags = delimiterFlanking(char, before, after, cjkEmphasis);

            runs.push({
                char,
                length,
                left: i,
                right: i + length,
                ...flags,
                canClose: flags.canClose || (cjkEmphasis && isCjkLabelCloser(src, i, i + length)),
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
    options: IInlineFeatures,
    allowAutolinks: boolean,
    codeSpans: ICodeSpanReader | undefined = src.includes('`') ? new CodeSpanScanner(src) : undefined,
    brackets = new BracketScanner(src, labels, codeSpans, { rules, options, offset }),
): Map<number, IDelimiterSpan> {
    const runs = collectRuns(src, {
        codeSpans,
        rules,
        brackets,
        offset,
        options,
        allowAutolinks,
        scanAutolinks:
            allowAutolinks
            && (src.includes('www.') || src.includes('http') || src.includes('ftp://') || src.includes('@')),
    });
    return pairDelimiters(runs, offset);
}
