import type { IHighlight, ITokenRange, Token } from './types';
import { union as intersectRanges } from '../utils';

function firstHighlightEndingAfter(highlights: readonly IHighlight[], offset: number): number {
    let start = 0;
    let end = highlights.length;

    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (highlights[middle].end <= offset)
            start = middle + 1;
        else
            end = middle;
    }

    return start;
}

function intersectingHighlights(
    range: ITokenRange,
    highlights: readonly IHighlight[],
    ordered: boolean,
): IHighlight[] {
    const matches: IHighlight[] = [];
    const first = ordered ? firstHighlightEndingAfter(highlights, range.start) : 0;

    for (let i = first; i < highlights.length; i++) {
        const highlight = highlights[i];
        if (ordered && highlight.start >= range.end)
            break;

        const intersection = intersectRanges(range, highlight);
        if (intersection)
            matches.push(intersection);
    }

    return matches;
}

// Annotate a fresh token tree with block-relative search ranges. Parents need
// their own highlights for syntax markers; their children render the content.
export function applySearchHighlights(tokens: readonly Token[], highlights: readonly IHighlight[]): void {
    if (!highlights.length)
        return;

    // Starts and ends must both be nondecreasing: ends drive binary lookup,
    // while starts allow early exit. Arbitrary ranges retain their input order.
    const ordered = highlights.every((highlight, i) => i === 0
        || (highlights[i - 1].start <= highlight.start && highlights[i - 1].end <= highlight.end));

    const visitTokens = (tokens: readonly Token[]): void => {
        for (const token of tokens) {
            const matches = intersectingHighlights(token.range, highlights, ordered);
            if (matches.length)
                token.highlights = matches;

            if ('children' in token && token.children)
                visitTokens(token.children);
        }
    };

    visitTokens(tokens);
}
